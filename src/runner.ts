import type { FlowRequest, FlowResult, FlowStep, LensClient, MintAuth, StorageState, Target } from "@broberg/lens-client";
import type { FieldInput, FormSchema, LocateSpecInput, PacingInput } from "./schema";
import { classifyResolution, type Severity } from "./degraded";
import type { StepRecord } from "./checkpoint";

/** Simple {{ key }} templating from a data record. Unknown keys are left as-is. */
export function render(value: string, data: Record<string, string> = {}): string {
  return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, k: string) => (k in data ? data[k]! : m));
}

/** The rendered value a field writes (fill/type/select/expectText), else null. */
function renderedValue(field: FieldInput, data: Record<string, string>): string | null {
  return field.value != null && ["fill", "type", "select", "expectText"].includes(field.action) ? render(field.value, data) : null;
}

function fieldToStep(field: FieldInput, data: Record<string, string>): FlowStep {
  const target = field.locator as Target;
  switch (field.action) {
    case "fill":
      return { action: "fill", target, value: render(field.value!, data) };
    case "type":
      return { action: "type", target, text: render(field.value!, data) };
    case "select":
      return { action: "select", target, value: render(field.value!, data) };
    case "click":
      return { action: "click", target };
    case "upload":
      return { action: "upload", target, files: field.files! };
    case "expectVisible":
      return { action: "expectVisible", target };
    case "expectText":
      return { action: "expectText", target, text: render(field.value!, data) };
  }
}

export interface BuildOpts {
  /** Overrides schema.base_url (e.g. the local fixture server URL). */
  baseUrl?: string;
  /** Values for {{ key }} templating in field values. */
  data?: Record<string, string>;
  /** Pre-authenticated session (the target's login — handled outside v1). */
  storageState?: StorageState;
  /** Or let Lens mint a session from the target's mint endpoint. */
  auth?: MintAuth;
  /** Resume: skip the first N fields (already completed — F001.4 checkpoint). */
  resumeFrom?: number;
  /** Override the schema's pacing interval (F001.9). */
  pacing?: PacingInput;
  /** Injectable RNG for pacing jitter (defaults to Math.random; set for tests). */
  rng?: () => number;
}

interface FieldRef {
  name: string;
  locator: LocateSpecInput;
  /** Absolute field index across the whole schema (stable under resume slicing). */
  index: number;
  /** Rendered value this field writes, or null (click/expectVisible/upload). */
  value: string | null;
}

/**
 * Translate a StoreForm schema into a lens-client FlowRequest. Pure (no I/O).
 * Also returns a flow-step-index → field map so a FlowResult can be attributed
 * back to schema fields for degraded-match reporting.
 */
export function buildFlow(schema: FormSchema, opts: BuildOpts = {}): { request: FlowRequest; fieldByStep: Map<number, FieldRef> } {
  const base_url = opts.baseUrl ?? schema.base_url;
  if (!base_url) throw new Error("buildFlow: base_url required (set schema.base_url or opts.baseUrl)");
  const data = opts.data ?? {};
  const resumeFrom = opts.resumeFrom ?? 0;
  const pacing = opts.pacing ?? schema.pacing;
  const rng = opts.rng ?? Math.random;
  const steps: FlowStep[] = [];
  const fieldByStep = new Map<number, FieldRef>();
  let fieldIdx = 0; // absolute field index across the whole schema

  for (const step of schema.steps) {
    // Navigation is always re-emitted (resume must re-open the form), only the
    // already-completed FIELDS are skipped.
    if (step.goto) {
      const goto: Extract<FlowStep, { action: "goto" }> = { action: "goto", url: step.goto };
      if (step.waitFor != null) goto.waitFor = step.waitFor;
      steps.push(goto);
    } else if (step.waitFor != null) {
      steps.push(typeof step.waitFor === "number" ? { action: "waitFor", ms: step.waitFor } : { action: "waitFor", target: step.waitFor });
    }
    for (const field of step.fields) {
      if (fieldIdx < resumeFrom) {
        fieldIdx++; // already completed in a prior run — never re-submit it
        continue;
      }
      // Human-like pacing (F001.9): a randomized wait before each field. A
      // `waitFor` Lens action — StoreForm never drives the browser itself.
      if (pacing) steps.push({ action: "waitFor", ms: Math.floor(rng() * (pacing.max_ms - pacing.min_ms + 1)) + pacing.min_ms });
      fieldByStep.set(steps.length, { name: field.name, locator: field.locator, index: fieldIdx, value: renderedValue(field, data) });
      steps.push(fieldToStep(field, data));
      fieldIdx++;
    }
  }

  const request: FlowRequest = { name: schema.form, base_url, steps };
  if (schema.viewport) request.viewport = schema.viewport;
  if (schema.device) request.device = schema.device;
  if (schema.mutates != null) request.mutates = schema.mutates;
  if (opts.storageState) request.storageState = opts.storageState;
  if (opts.auth) request.auth = opts.auth;
  return { request, fieldByStep };
}

export interface DegradedMatch {
  field: string;
  index: number;
  resolved_via: string;
  severity: Exclude<Severity, "ok">;
}

export interface RunReport {
  status: FlowResult["status"];
  degraded: DegradedMatch[];
  failure?: { field?: string; index: number; action: string; error?: string; screenshot_url?: string };
  /** Per-field outcomes (absolute index) ready to persist as checkpoint state. */
  records: StepRecord[];
  result: FlowResult;
}

/**
 * Analyse a FlowResult against the schema: collect degraded matches, the first
 * failing step, and per-field checkpoint records. Pure — unit-testable without
 * a live Lens.
 */
export function analyse(result: FlowResult, fieldByStep: Map<number, FieldRef>): RunReport {
  const degraded: DegradedMatch[] = [];
  const records: StepRecord[] = [];
  let failure: RunReport["failure"];
  for (const s of result.steps) {
    const f = fieldByStep.get(s.index);
    if (f) {
      const severity = classifyResolution(f.locator, s.resolved_via);
      if (severity !== "ok") degraded.push({ field: f.name, index: s.index, resolved_via: s.resolved_via!, severity });
      records.push({
        index: f.index,
        name: f.name,
        value: f.value,
        resolved_via: s.resolved_via ?? null,
        screenshot_url: s.screenshot_url ?? null,
        status: s.status,
      });
    }
    if (s.status === "failed" && !failure) {
      failure = { field: f?.name, index: s.index, action: s.action, error: s.error, screenshot_url: s.screenshot_url };
    }
  }
  return { status: result.status, degraded, failure, records, result };
}

/**
 * Build → run (via Lens) → analyse. A failing flow comes back as DATA (never
 * thrown) — that is StoreForm's graceful-fail contract: stop, report which
 * field/why, never guess or submit. Only transport/auth errors throw.
 */
export async function runForm(schema: FormSchema, client: LensClient, opts: BuildOpts = {}): Promise<RunReport> {
  const { request, fieldByStep } = buildFlow(schema, opts);
  const result = await client.runFlow(request);
  return analyse(result, fieldByStep);
}
