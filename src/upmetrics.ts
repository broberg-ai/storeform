import type { DegradedMatch } from "./runner";
import { emitDegraded } from "./telemetry";

/**
 * Report degraded matches: locally to stderr (always) AND to Upmetrics as a
 * soft 'degraded-match' signal (when telemetry is live). A degraded match = the
 * run worked but the preferred locator layer did NOT — a schema-drift signal
 * (vision = strongest). Never throws; telemetry must not break a run.
 */
export function reportDegraded(form: string, matches: DegradedMatch[]): void {
  for (const m of matches) {
    const msg = `degraded-match: form=${form} field=${m.field} resolved_via=${m.resolved_via} severity=${m.severity}`;
    console.warn(`[${msg}]`);
    emitDegraded(msg);
  }
}
