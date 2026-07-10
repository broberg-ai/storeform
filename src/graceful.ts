import { mkdirSync, writeFileSync } from "node:fs";
import type { FormSchema } from "./schema";
import type { RunReport } from "./runner";

/**
 * Graceful fail (F001.8): when the layered locator chain runs dry for a field,
 * the flow STOPS (a failed flow is data — the engine never guesses/submits). We
 * then persist a "needs review" report + notify, so a human fixes the schema.
 * A wrong submit to Apple/Google is often irreversible → stop-and-ask always wins.
 */
export interface FailureReport {
  form: string;
  base_url?: string;
  failed_field?: string;
  action?: string;
  error?: string;
  screenshot_url?: string;
  /** How many fields were filled OK before the run stopped. */
  completed_fields: number;
  ts: string;
}

export function buildFailureReport(schema: FormSchema, report: RunReport, opts: { baseUrl?: string } = {}): FailureReport {
  return {
    form: schema.form,
    base_url: opts.baseUrl,
    failed_field: report.failure?.field,
    action: report.failure?.action,
    error: report.failure?.error,
    screenshot_url: report.failure?.screenshot_url,
    completed_fields: report.records.filter((r) => r.status === "ok").length,
    ts: new Date().toISOString(),
  };
}

/** Persist the report as a local artifact (audit + resume context). Returns path. */
export function writeFailureReport(r: FailureReport, dir = ".storeform/failures"): string {
  mkdirSync(dir, { recursive: true });
  const slug = r.form.replace(/[^a-z0-9]+/gi, "-");
  const path = `${dir}/${slug}-${Date.now()}.json`;
  writeFileSync(path, JSON.stringify(r, null, 2));
  return path;
}

/** Human-readable "needs review" message for the cardmem Inbox / notify sink. */
export function failureMessage(r: FailureReport): string {
  return [
    `[needs-review] StoreForm — locator chain exhausted (schema needs a better locator)`,
    `form: ${r.form}`,
    `field: ${r.failed_field ?? "?"} (action ${r.action ?? "?"})`,
    `error: ${r.error ?? "unknown"}`,
    `filled ${r.completed_fields} field(s) OK before stopping — NO data submitted (stopped before submit).`,
    r.screenshot_url ? `screenshot: ${r.screenshot_url}` : "",
    r.base_url ? `url: ${r.base_url}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Notify on graceful fail. Ship-dark: no-op unless the env is set. Never throws
 * (a notification failure must not mask the run failure).
 * - STOREFORM_CARDMEM_INBOX_* → creates a "needs review" item in the project's
 *   cardmem Inbox (the runtime-appropriate reuse-first channel; a cc session /
 *   human promotes it to a story — the cardmem-native needs-review flow).
 * - STOREFORM_NOTIFY_WEBHOOK → optional generic sink (e.g. a Buddycloud endpoint).
 */
export async function notifyFailure(r: FailureReport): Promise<{ cardmem: boolean; webhook: boolean }> {
  const out = { cardmem: false, webhook: false };
  const inboxUrl = process.env.STOREFORM_CARDMEM_INBOX_URL;
  const inboxKey = process.env.STOREFORM_CARDMEM_INBOX_KEY;
  if (inboxUrl && inboxKey) {
    try {
      const res = await fetch(inboxUrl, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${inboxKey}` },
        body: JSON.stringify({ text: failureMessage(r), tags: ["needs-review", "storeform", r.form] }),
      });
      out.cardmem = res.ok;
    } catch {
      /* notification must never break the fail path */
    }
  }
  const webhook = process.env.STOREFORM_NOTIFY_WEBHOOK;
  if (webhook) {
    try {
      const res = await fetch(webhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(r) });
      out.webhook = res.ok;
    } catch {
      /* ignore */
    }
  }
  return out;
}
