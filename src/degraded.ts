import type { LocateSpecInput } from "./schema";

/** Lens self-heal layer priority (matches @broberg/lens-client resolveTarget). */
export const LAYER_PRIORITY = ["testid", "css", "role", "label", "placeholder", "text", "vision"] as const;
export type Layer = (typeof LAYER_PRIORITY)[number];

/**
 * The highest-priority layer the schema author PROVIDED for this locator.
 * `name` counts as part of `role`. Returns null only if none were given
 * (the schema refine guarantees at least one, so callers can treat null as ok).
 */
export function topLayer(spec: LocateSpecInput): Layer | null {
  for (const layer of LAYER_PRIORITY) {
    const present = layer === "role" ? spec.role != null : (spec as Record<string, unknown>)[layer] != null;
    if (present) return layer;
  }
  return null;
}

export type Severity = "ok" | "degraded" | "vision";

/**
 * Compare what actually resolved (`resolved_via`, from Lens) against the top
 * layer the schema provided. A resolution BELOW the top layer = a degraded
 * match: the run still worked, but the preferred anchor didn't — the schema
 * field probably needs a better locator. Vision is the strongest signal.
 */
export function classifyResolution(spec: LocateSpecInput, resolvedVia: string | undefined): Severity {
  if (!resolvedVia) return "ok";
  if (resolvedVia === "vision") return "vision";
  const top = topLayer(spec);
  if (!top) return "ok";
  const gotIdx = LAYER_PRIORITY.indexOf(resolvedVia as Layer);
  if (gotIdx < 0) return "ok";
  return gotIdx > LAYER_PRIORITY.indexOf(top) ? "degraded" : "ok";
}
