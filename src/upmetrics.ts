import type { DegradedMatch } from "./runner";

/**
 * Report degraded matches. Ship-dark for now: structured to stderr; the real
 * Upmetrics sink is wired in F001.1 (needs UPMETRICS_DSN). A degraded match =
 * the run worked but the preferred locator layer did NOT — a schema-drift
 * signal (vision = strongest). Never throws; telemetry must not break a run.
 */
export function reportDegraded(form: string, matches: DegradedMatch[]): void {
  for (const m of matches) {
    console.warn(`[degraded-match] form=${form} field=${m.field} resolved_via=${m.resolved_via} severity=${m.severity}`);
  }
  // TODO(F001.1): emit to Upmetrics when UPMETRICS_DSN is configured.
}
