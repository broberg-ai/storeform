import { readFileSync } from "node:fs";
import type { StorageState } from "@broberg/lens-client";
import { loadSchema } from "./schema";
import { buildFlow, runForm } from "./runner";
import { getLensClient } from "./lens";
import { reportDegraded } from "./upmetrics";

/**
 * StoreForm CLI — the v1 manual trigger (§8: manual CLI). Drives a schema
 * through Lens (via @broberg/lens-client). Login/2FA is handled OUTSIDE v1:
 * pass a pre-authenticated Playwright storageState with --state.
 *
 *   bun run src/run.ts <schema.yaml> --base-url <url> \
 *     [--state storageState.json] [--data key=value]... [--dry]
 *
 * --dry prints the translated FlowRequest without calling Lens (no token needed).
 */
export interface RunArgs {
  schemaPath?: string;
  baseUrl?: string;
  statePath?: string;
  data: Record<string, string>;
  dry: boolean;
}

export function parseRunArgs(argv: string[]): RunArgs {
  const args: RunArgs = { data: {}, dry: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--dry") args.dry = true;
    else if (a === "--base-url") args.baseUrl = argv[++i];
    else if (a === "--state") args.statePath = argv[++i];
    else if (a === "--data") {
      const kv = argv[++i] ?? "";
      const eq = kv.indexOf("=");
      if (eq > 0) args.data[kv.slice(0, eq)] = kv.slice(eq + 1);
    } else if (!a.startsWith("--") && !args.schemaPath) {
      args.schemaPath = a;
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseRunArgs(Bun.argv.slice(2));
  if (!args.schemaPath) {
    console.error("usage: bun run src/run.ts <schema.yaml> [--base-url URL] [--state storageState.json] [--data k=v]... [--dry]");
    process.exit(2);
  }
  const schema = loadSchema(args.schemaPath);
  const storageState = args.statePath ? (JSON.parse(readFileSync(args.statePath, "utf8")) as StorageState) : undefined;

  if (args.dry) {
    const { request } = buildFlow(schema, { baseUrl: args.baseUrl, data: args.data, storageState });
    console.log(JSON.stringify(request, null, 2));
    return;
  }

  const client = getLensClient();
  try {
    const report = await runForm(schema, client, { baseUrl: args.baseUrl, data: args.data, storageState });
    reportDegraded(schema.form, report.degraded);
    if (report.status === "passed") {
      console.log(`✓ ${schema.form}: passed — ${report.result.steps.length} steps, ${report.degraded.length} degraded match(es)`);
    } else {
      const f = report.failure;
      console.error(`✗ ${schema.form}: FAILED at step ${f?.index} (${f?.action}${f?.field ? " · " + f.field : ""}): ${f?.error ?? "unknown"}`);
      if (f?.screenshot_url) console.error(`  screenshot: ${f.screenshot_url}`);
      process.exit(1);
    }
  } catch (e) {
    // LensClientError (transport/auth): token missing, service ship-dark, network after retry.
    console.error(`✗ Lens transport/auth error: ${(e as Error).message}`);
    process.exit(3);
  }
}

if (import.meta.main) void main();
