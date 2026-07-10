import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { buildFailureReport, failureMessage, notifyFailure, writeFailureReport } from "../src/graceful";
import type { RunReport } from "../src/runner";
import type { FormSchema } from "../src/schema";

const schema: FormSchema = {
  form: "app-store-connect/version-submission",
  steps: [{ id: "s", fields: [{ name: "keywords", action: "fill", locator: { label: "Keywords" }, value: "a,b" }] }],
};

const failedReport: RunReport = {
  status: "failed",
  degraded: [],
  failure: { field: "keywords", index: 2, action: "fill", error: "locate: no layer matched", screenshot_url: "shot.png" },
  records: [
    { index: 0, name: "whats-new", value: "hi", resolved_via: "label", screenshot_url: null, status: "ok" },
    { index: 1, name: "promo", value: "yo", resolved_via: "role", screenshot_url: null, status: "ok" },
    { index: 2, name: "keywords", value: "a,b", resolved_via: null, screenshot_url: "shot.png", status: "failed" },
  ],
  result: { run_id: "r", status: "failed", steps: [] },
};

describe("graceful fail (F001.8)", () => {
  test("buildFailureReport captures the failed field + completed count", () => {
    const fr = buildFailureReport(schema, failedReport, { baseUrl: "https://appstoreconnect.apple.com/x" });
    expect(fr.form).toBe("app-store-connect/version-submission");
    expect(fr.failed_field).toBe("keywords");
    expect(fr.action).toBe("fill");
    expect(fr.error).toBe("locate: no layer matched");
    expect(fr.screenshot_url).toBe("shot.png");
    expect(fr.completed_fields).toBe(2); // two fields filled OK before stopping
    expect(fr.base_url).toBe("https://appstoreconnect.apple.com/x");
  });

  test("failureMessage states no data was submitted", () => {
    const msg = failureMessage(buildFailureReport(schema, failedReport));
    expect(msg).toContain("keywords");
    expect(msg).toContain("NO data submitted");
  });

  test("writeFailureReport persists a readable JSON artifact", () => {
    const dir = `${tmpdir()}/storeform-test-${Date.now()}`;
    const fr = buildFailureReport(schema, failedReport);
    const path = writeFailureReport(fr, dir);
    expect(JSON.parse(readFileSync(path, "utf8")).failed_field).toBe("keywords");
  });

  test("notifyFailure posts a cardmem inbox item when configured, ship-dark otherwise", async () => {
    const fr = buildFailureReport(schema, failedReport);
    const saved = {
      url: process.env.STOREFORM_CARDMEM_INBOX_URL,
      key: process.env.STOREFORM_CARDMEM_INBOX_KEY,
      wh: process.env.STOREFORM_NOTIFY_WEBHOOK,
    };
    const origFetch = globalThis.fetch;
    const calls: { url: string; body: { text: string; tags: string[] } }[] = [];
    globalThis.fetch = (async (u: unknown, init: { body: string }) => {
      calls.push({ url: String(u), body: JSON.parse(init.body) });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    try {
      process.env.STOREFORM_CARDMEM_INBOX_URL = "https://x/api/board/idea";
      process.env.STOREFORM_CARDMEM_INBOX_KEY = "piw_test";
      delete process.env.STOREFORM_NOTIFY_WEBHOOK;
      const out = await notifyFailure(fr);
      expect(out.cardmem).toBe(true);
      expect(calls).toHaveLength(1);
      expect(calls[0]!.url).toContain("/api/board/idea");
      expect(calls[0]!.body.text).toContain("keywords");
      expect(calls[0]!.body.tags).toContain("needs-review");

      delete process.env.STOREFORM_CARDMEM_INBOX_URL;
      delete process.env.STOREFORM_CARDMEM_INBOX_KEY;
      const out2 = await notifyFailure(fr);
      expect(out2).toEqual({ cardmem: false, webhook: false });
      expect(calls).toHaveLength(1); // no additional POST when ship-dark
    } finally {
      globalThis.fetch = origFetch;
      if (saved.url) process.env.STOREFORM_CARDMEM_INBOX_URL = saved.url;
      else delete process.env.STOREFORM_CARDMEM_INBOX_URL;
      if (saved.key) process.env.STOREFORM_CARDMEM_INBOX_KEY = saved.key;
      else delete process.env.STOREFORM_CARDMEM_INBOX_KEY;
      if (saved.wh) process.env.STOREFORM_NOTIFY_WEBHOOK = saved.wh;
    }
  });
});
