import { describe, expect, test } from "bun:test";
import { parseRunArgs } from "../src/run";
import { buildFlow } from "../src/runner";
import type { FormSchema } from "../src/schema";
import type { StorageState } from "@broberg/lens-client";

describe("parseRunArgs", () => {
  test("parses schema path, flags and repeated --data", () => {
    const a = parseRunArgs([
      "schemas/x.yaml",
      "--base-url",
      "https://example.com",
      "--state",
      "s.json",
      "--data",
      "app=StoreForm",
      "--data",
      "note=hej=med=lighedstegn",
      "--dry",
    ]);
    expect(a.schemaPath).toBe("schemas/x.yaml");
    expect(a.baseUrl).toBe("https://example.com");
    expect(a.statePath).toBe("s.json");
    expect(a.data).toEqual({ app: "StoreForm", note: "hej=med=lighedstegn" });
    expect(a.dry).toBe(true);
  });

  test("defaults: no schema, no dry, no daemon", () => {
    const a = parseRunArgs([]);
    expect(a.schemaPath).toBeUndefined();
    expect(a.dry).toBe(false);
    expect(a.daemon).toBe(false);
    expect(a.data).toEqual({});
  });

  test("--daemon routes to the local daemon", () => {
    const a = parseRunArgs(["schemas/asc.yaml", "--daemon", "--state", "asc-state.json"]);
    expect(a.daemon).toBe(true);
    expect(a.statePath).toBe("asc-state.json");
  });
});

describe("buildFlow auth wiring", () => {
  const schema: FormSchema = {
    form: "test/x",
    steps: [{ id: "s", fields: [{ name: "a", action: "click", locator: { testid: "a" } }] }],
  };

  test("attaches a pre-authenticated storageState to the FlowRequest", () => {
    const storageState: StorageState = { cookies: [{ name: "sess", value: "abc" }] };
    const { request } = buildFlow(schema, { baseUrl: "https://x", storageState });
    expect(request.storageState).toEqual(storageState);
    expect(request.auth).toBeUndefined();
  });

  test("attaches a mintEndpoint auth when given", () => {
    const { request } = buildFlow(schema, { baseUrl: "https://x", auth: { adapter: "mintEndpoint", url: "https://x/mint" } });
    expect(request.auth).toEqual({ adapter: "mintEndpoint", url: "https://x/mint" });
  });
});
