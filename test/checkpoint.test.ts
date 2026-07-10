import { describe, expect, test } from "bun:test";
import type { FlowRequest, FlowResult, LensClient } from "@broberg/lens-client";
import { buildFlow, runForm } from "../src/runner";
import { clearCheckpoint, openCheckpointDb, recordStep, resumePoint } from "../src/checkpoint";
import type { FormSchema } from "../src/schema";

const schema: FormSchema = {
  form: "test/checkpoint",
  steps: [
    {
      id: "s",
      fields: [
        { name: "f0", action: "fill", locator: { role: "textbox", name: "F0" }, value: "v0" },
        { name: "f1", action: "fill", locator: { role: "textbox", name: "F1" }, value: "v1" },
        { name: "f2", action: "fill", locator: { role: "textbox", name: "F2" }, value: "v2" },
        { name: "f3", action: "click", locator: { role: "button", name: "F3" } },
        { name: "f4", action: "expectVisible", locator: { role: "button", name: "F4" } },
      ],
    },
  ],
};

/** A fake Lens that marks steps ok up to `failAt` (which fails + stops the flow). */
function mockClient(failAt: number | null): LensClient {
  return {
    baseUrl: "mock",
    async runFlow(body: FlowRequest): Promise<FlowResult> {
      const steps: FlowResult["steps"] = [];
      for (let i = 0; i < body.steps.length; i++) {
        const action = (body.steps[i] as { action: string }).action;
        if (failAt !== null && i === failAt) {
          steps.push({ index: i, action, status: "failed", ms: 1, error: "no match", screenshot_url: "shot.png" });
          break; // a failing step stops the flow
        }
        steps.push({ index: i, action, status: "ok", ms: 1, resolved_via: "role" });
      }
      return { run_id: "r", status: steps.some((s) => s.status === "failed") ? "failed" : "passed", steps };
    },
    capture: async () => { throw new Error("not used"); },
    health: async () => true,
    fetchArtifact: async () => new Uint8Array(),
  } as unknown as LensClient;
}

describe("checkpoint store (F001.4)", () => {
  test("resumePoint = leading run of consecutively-ok fields", () => {
    const db = openCheckpointDb(":memory:");
    recordStep(db, "f", { index: 0, name: "a", value: "x", resolved_via: "role", screenshot_url: null, status: "ok" });
    recordStep(db, "f", { index: 1, name: "b", value: null, resolved_via: "label", screenshot_url: null, status: "ok" });
    recordStep(db, "f", { index: 2, name: "c", value: null, resolved_via: null, screenshot_url: "s.png", status: "failed" });
    expect(resumePoint(db, "f")).toBe(2); // 0,1 ok → resume at 2
    recordStep(db, "f", { index: 2, name: "c", value: null, resolved_via: "text", screenshot_url: null, status: "ok" });
    expect(resumePoint(db, "f")).toBe(3); // now 0,1,2 ok
    clearCheckpoint(db, "f");
    expect(resumePoint(db, "f")).toBe(0);
  });

  test("persists field name + value + screenshot path (AC0)", () => {
    const db = openCheckpointDb(":memory:");
    recordStep(db, "f", { index: 0, name: "release-notes", value: "hej", resolved_via: "label", screenshot_url: "shot.png", status: "ok" });
    const row = db.query<{ name: string; value: string; screenshot_url: string }, [string]>(
      `SELECT name, value, screenshot_url FROM checkpoints WHERE form = ?`,
    ).get("f");
    expect(row).toEqual({ name: "release-notes", value: "hej", screenshot_url: "shot.png" });
  });
});

describe("resume (F001.4 AC1/AC2)", () => {
  test("a run interrupted at field 2 resumes from field 2 and completes without repeating 0..1", async () => {
    const db = openCheckpointDb(":memory:");

    // Run 1 — fails at field 2 (the 3rd field). Persist progress.
    const r1 = await runForm(schema, mockClient(2), { baseUrl: "http://x" });
    for (const rec of r1.records) recordStep(db, schema.form, rec);
    expect(r1.status).toBe("failed");
    expect(resumePoint(db, schema.form)).toBe(2);

    // Resume — the built flow must contain ONLY fields 2,3,4 (0,1 never re-submitted).
    const resumeFrom = resumePoint(db, schema.form);
    const { request } = buildFlow(schema, { baseUrl: "http://x", resumeFrom });
    expect(request.steps).toHaveLength(3);
    expect(request.steps.map((s) => (s as { target?: { name?: string } }).target?.name)).toEqual(["F2", "F3", "F4"]);

    // Run 2 — completes the rest.
    const r2 = await runForm(schema, mockClient(null), { baseUrl: "http://x", resumeFrom });
    for (const rec of r2.records) recordStep(db, schema.form, rec);
    expect(r2.status).toBe("passed");
    expect(resumePoint(db, schema.form)).toBe(5); // all five fields done
  });
});
