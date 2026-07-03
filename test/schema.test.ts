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
