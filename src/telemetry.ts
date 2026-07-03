import { captureException, captureMessage, init } from "@upmetrics/sdk";

let enabled = false;

/**
 * Initialise Upmetrics error-tracking at boot. Ship-dark: with no UPMETRICS_DSN
 * set it is a no-op (no crash, no telemetry) — so the CLI runs fine locally
 * without credentials. Returns whether telemetry is live.
 */
export function initTelemetry(): boolean {
  const dsn = process.env.UPMETRICS_DSN;
  if (!dsn) return false;
  init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.STOREFORM_RELEASE ?? "storeform@0.1.0",
  });
  enabled = true;
  return true;
}

export function telemetryEnabled(): boolean {
  return enabled;
}

/**
 * Emit a soft 'degraded-match' drift signal — a locator that only held via a
 * weaker layer. Per Upmetrics: captureMessage(warning) → kind='message', which
 * is NEVER grouped into an issue and NEVER triggers spike-remediation. The
 * correct channel for a non-error signal.
 */
export function emitDegraded(message: string): void {
  if (enabled) captureMessage(message, "warning");
}

/** Capture a real error (grouped into an Upmetrics issue). No-op when dark. */
export function emitException(err: unknown, ctx?: Record<string, unknown>): void {
  if (enabled) captureException(err, ctx);
}
