import { describe, expect, test } from "bun:test";
import { loadSchema, parseSchema } from "../src/schema";

describe("schema", () => {
  test("parses the Zone A sample schema", () => {
    const schema = loadSchema(new URL("../schemas/extreme-form.zoneA.yaml", import.meta.url).pathname);
    expect(schema.form).toBe("test/extreme-form-zoneA");
    expect(schema.steps).toHaveLength(1);
    expect(schema.steps[0]!.fields.length).toBeGreaterThanOrEqual(5);
  });

  test("accepts JSON (JSON is valid YAML)", () => {
    const s = parseSchema(
      JSON.stringify({ form: "x", steps: [{ id: "s", fields: [{ name: "a", action: "click", locator: { testid: "a" } }] }] }),
    );
    expect(s.form).toBe("x");
  });

  test("rejects a locator with no layers", () => {
    expect(() =>
      parseSchema("form: x\nsteps:\n  - id: s\n    fields:\n      - name: a\n        action: click\n        locator: {}\n"),
    ).toThrow();
  });

  test("rejects fill without a value", () => {
    expect(() =>
      parseSchema("form: x\nsteps:\n  - id: s\n    fields:\n      - name: a\n        action: fill\n        locator: { testid: a }\n"),
    ).toThrow();
  });
});

describe("platform-agnostic schemas (F001.6)", () => {
  // The SAME parser/engine loads both platform schemas — proof StoreForm is
  // platform-agnostic: only the schema differs, no per-platform engine code.
  test("App Store Connect + Google Play schemas both parse with the same engine", () => {
    const asc = loadSchema(new URL("../schemas/app-store-connect.version-submission.yaml", import.meta.url).pathname);
    const gp = loadSchema(new URL("../schemas/google-play.production-release.yaml", import.meta.url).pathname);
    expect(asc.form).toBe("app-store-connect/version-submission");
    expect(gp.form).toBe("google-play/production-release");
    // both drive testid-less forms via layered self-heal locators
    for (const s of [asc, gp]) {
      expect(s.steps.length).toBeGreaterThanOrEqual(1);
      const fields = s.steps.flatMap((st) => st.fields);
      expect(fields.every((f) => f.locator.label || f.locator.role || f.locator.text)).toBe(true);
      // v1 stops before the irreversible submit — no click on a submit/publish button
      expect(fields.some((f) => f.action === "expectVisible")).toBe(true);
    }
  });
});
