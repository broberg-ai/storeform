import { readFileSync } from "node:fs";
import type { StorageState } from "@broberg/lens-client";
import { loadSchema } from "./schema";
import { buildFlow, runForm } from "./runner";
import { getLensClient } from "./lens";
import { reportDegraded } from "./upmetrics";
import { emitException, initTelemetry } from "./telemetry";
import { clearCheckpoint, openCheckpointDb, recordStep, resumePoint } from "./checkpoint";
import { buildFailureReport, notifyFailure, writeFailureReport } from "./graceful";

/**
 * The local cardmem Lens daemon's tokenless flow target. Used for device/IP-bound
 * targets (e.g. App Store Connect): the daemon runs on the same machine + IP as the
 * login, so Apple accepts the session — unlike cloud Lens's datacenter IP. token:""
 * blocks the LENS_CLOUD_TOKEN env-fallback so the cloud Bearer never leaks locally.
 */
const DAEMON_LENS_URL = "http://127.0.0.1:7475/lens";

/**
 * StoreForm CLI — the v1 manual trigger (§8: manual CLI). Drives a schema
 * through Lens (via @broberg/lens-client). Login/2FA is handled OUTSIDE v1:
 * pass a pre-authenticated Playwright storageState with --state.
 *
 *   bun run src/run.ts <schema.yaml> --base-url <url> \
 *     [--daemon] [--state storageState.json] [--data key=value]... [--resume] [--dry]
 *
 * --daemon routes to the LOCAL Lens daemon (same-IP, tokenless) instead of cloud
 * Lens — required for device/IP-bound 2FA sites like ASC. --resume continues an
 * interrupted run from the first unfinished field (F001.4 checkpoint). --dry
 * prints the translated FlowRequest without calling Lens (no token needed).
 */
export interface RunArgs {
  schemaPath?: string;
  baseUrl?: string;
  statePath?: string;
  data: Record<string, string>;
  dry: boolean;
  daemon: boolean;
  resume: boolean;
}

export function parseRunArgs(argv: string[]): RunArgs {
  const args: RunArgs = { data: {}, dry: false, daemon: false, resume: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--dry") args.dry = true;
    else if (a === "--daemon") args.daemon = true;
    else if (a === "--resume") args.resume = true;
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
  initTelemetry(); // Upmetrics error-tracking (ship-dark without UPMETRICS_DSN)
  const args = parseRunArgs(Bun.argv.slice(2));
  if (!args.schemaPath) {
    console.error("usage: bun run src/run.ts <schema.yaml> [--daemon] [--base-url URL] [--state storageState.json] [--data k=v]... [--resume] [--dry]");
    process.exit(2);
  }
  const schema = loadSchema(args.schemaPath);
  const storageState = args.statePath ? (JSON.parse(readFileSync(args.statePath, "utf8")) as StorageState) : undefined;

  if (args.dry) {
    const { request } = buildFlow(schema, { baseUrl: args.baseUrl, data: args.data, storageState });
    console.log(JSON.stringify(request, null, 2));
    return;
  }

  // Checkpoint (F001.4): --resume continues from the first unfinished field; a
  // fresh run clears the form's prior checkpoint so it starts from field 0.
  const db = openCheckpointDb();
  const resumeFrom = args.resume ? resumePoint(db, schema.form) : (clearCheckpoint(db, schema.form), 0);
  if (args.resume && resumeFrom > 0) console.log(`↻ resuming ${schema.form} from field ${resumeFrom}`);

  const client = args.daemon ? getLensClient({ baseUrl: DAEMON_LENS_URL, token: "", prewarm: false }) : getLensClient();
  try {
    const report = await runForm(schema, client, { baseUrl: args.baseUrl, data: args.data, storageState, resumeFrom });
    for (const r of report.records) recordStep(db, schema.form, r); // persist progress for a future --resume
    reportDegraded(schema.form, report.degraded);
    if (report.status === "passed") {
      console.log(`✓ ${schema.form}: passed — ${report.result.steps.length} steps, ${report.degraded.length} degraded match(es)`);
    } else {
      const f = report.failure;
      console.error(`✗ ${schema.form}: FAILED at step ${f?.index} (${f?.action}${f?.field ? " · " + f.field : ""}): ${f?.error ?? "unknown"}`);
      if (f?.screenshot_url) console.error(`  screenshot: ${f.screenshot_url}`);
      // Graceful fail (F001.8): STOP, persist a "needs review" report + notify —
      // never guess, never submit. Checkpoint already saved per-field state above.
      const failure = buildFailureReport(schema, report, { baseUrl: args.baseUrl });
      const reportPath = writeFailureReport(failure);
      const notified = await notifyFailure(failure);
      console.error(`  needs-review saved: ${reportPath}${notified.cardmem ? " · cardmem inbox item created" : ""}`);
      process.exit(1);
    }
  } catch (e) {
    // LensClientError (transport/auth): token missing, service ship-dark, network after retry.
    emitException(e, { schema: schema.form });
    console.error(`✗ Lens transport/auth error: ${(e as Error).message}`);
    process.exit(3);
  }
}

if (import.meta.main) void main();
