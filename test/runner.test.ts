import { describe, expect, test } from "bun:test";
import type { FlowResult } from "@broberg/lens-client";
import { analyse, buildFlow, render } from "../src/runner";
import { classifyResolution } from "../src/degraded";
import type { FormSchema } from "../src/schema";

const schema: FormSchema = {
  form: "test/x",
  steps: [
    {
      id: "s1",
      goto: "/",
      fields: [
        { name: "title", action: "fill", locator: { testid: "text-title", role: "textbox" }, value: "{{ app }}" },
        { name: "country", action: "select", locator: { testid: "select-country" }, value: "Danmark" },
        { name: "go", action: "click", locator: { role: "button", name: "Submit" } },
      ],
    },
  ],
};

describe("render", () => {
  test("substitutes {{ key }} and leaves unknowns", () => {
    expect(render("hi {{ app }} {{ x }}", { app: "StoreForm" })).toBe("hi StoreForm {{ x }}");
  });
});

describe("buildFlow", () => {
  test("translates schema → FlowRequest steps", () => {
    const { request, fieldByStep } = buildFlow(schema, { baseUrl: "http://localhost:4599", data: { app: "StoreForm" } });
    expect(request.base_url).toBe("http://localhost:4599");
    expect(request.steps).toHaveLength(4); // goto + 3 fields
    expect(request.steps[0]).toEqual({ action: "goto", url: "/" });
    expect(request.steps[1]).toEqual({ action: "fill", target: { testid: "text-title", role: "textbox" }, value: "StoreForm" });
    expect(request.steps[2]).toEqual({ action: "select", target: { testid: "select-country" }, value: "Danmark" });
    expect(request.steps[3]).toEqual({ action: "click", target: { role: "button", name: "Submit" } });
    expect(fieldByStep.get(1)?.name).toBe("title");
    expect(fieldByStep.get(3)?.name).toBe("go");
  });

  test("a goto-less schema emits no leading goto (cloud Lens auto-navigates to base_url)", () => {
    // sky-Lens reached parity with the daemon (lens-engine@0.1.1): a goto-less
    // flow auto-navigates to base_url before step 0, so the engine must NOT
    // inject one — step 0 is the first field.
    const noGoto: FormSchema = {
      form: "test/y",
      steps: [{ id: "s1", fields: [{ name: "title", action: "fill", locator: { role: "textbox" }, value: "x" }] }],
    };
    const { request, fieldByStep } = buildFlow(noGoto, { baseUrl: "http://localhost:4599" });
    expect(request.steps).toHaveLength(1); // no injected goto — just the field
    expect(request.steps[0]).toEqual({ action: "fill", target: { role: "textbox" }, value: "x" });
    expect(fieldByStep.get(0)?.name).toBe("title");
  });

  test("pacing inserts a randomized waitFor before each field (F001.9)", () => {
    const paced: FormSchema = {
      form: "test/pace",
      pacing: { min_ms: 200, max_ms: 800 },
      steps: [
        {
          id: "s",
          fields: [
            { name: "a", action: "fill", locator: { role: "textbox" }, value: "x" },
            { name: "b", action: "click", locator: { role: "button", name: "Go" } },
          ],
        },
      ],
    };
    const { request, fieldByStep } = buildFlow(paced, { baseUrl: "http://x", rng: () => 0.5 });
    expect(request.steps).toHaveLength(4); // waitFor, fill, waitFor, click
    // rng()=0.5 → floor(0.5*(800-200+1))+200 = 500
    expect(request.steps[0]).toEqual({ action: "waitFor", ms: 500 });
    expect(request.steps[1]).toEqual({ action: "fill", target: { role: "textbox" }, value: "x" });
    expect(request.steps[2]).toEqual({ action: "waitFor", ms: 500 });
    expect(request.steps[3]).toEqual({ action: "click", target: { role: "button", name: "Go" } });
    // field→step mapping stays correct past the injected waits
    expect(fieldByStep.get(1)?.name).toBe("a");
    expect(fieldByStep.get(3)?.name).toBe("b");
  });

  test("throws without a base_url", () => {
    expect(() => buildFlow(schema)).toThrow();
  });
});

describe("degraded classification", () => {
  test("resolved via testid when testid provided = ok", () => {
    expect(classifyResolution({ testid: "a", role: "button" }, "testid")).toBe("ok");
  });
  test("resolved via role when testid provided = degraded", () => {
    expect(classifyResolution({ testid: "a", role: "button" }, "role")).toBe("degraded");
  });
  test("resolved via role when role is the top layer = ok", () => {
    expect(classifyResolution({ role: "button", name: "Submit" }, "role")).toBe("ok");
  });
  test("vision is always the strongest signal", () => {
    expect(classifyResolution({ testid: "a" }, "vision")).toBe("vision");
  });
});

describe("analyse", () => {
  test("collects degraded matches + the first failure from a FlowResult", () => {
    const { fieldByStep } = buildFlow(schema, { baseUrl: "http://x", data: { app: "y" } });
    const result: FlowResult = {
      run_id: "r1",
      status: "failed",
      steps: [
        { index: 0, action: "goto", status: "ok", ms: 1 },
        { index: 1, action: "fill", status: "ok", ms: 2, resolved_via: "role" }, // testid provided → degraded
        { index: 2, action: "select", status: "ok", ms: 2, resolved_via: "testid" }, // ok
        { index: 3, action: "click", status: "failed", ms: 5, error: "no match", screenshot_url: "u" },
      ],
    };
    const report = analyse(result, fieldByStep);
    expect(report.status).toBe("failed");
    expect(report.degraded).toEqual([{ field: "title", index: 1, resolved_via: "role", severity: "degraded" }]);
    expect(report.failure).toEqual({ field: "go", index: 3, action: "click", error: "no match", screenshot_url: "u" });
  });
});
