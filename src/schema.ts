import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

/**
 * One self-healing locator target — mirrors @broberg/lens-client `LocateSpec`.
 * Provide as many layers as known; Lens tries them in fixed priority order
 * (testid → css → role → label → placeholder → text → vision) and reports which
 * one actually resolved (`resolved_via`). A schema field carries ONE such spec;
 * the layering IS the self-heal (not an array of alternatives).
 */
export const locateSpecSchema = z
  .object({
    testid: z.string().optional(),
    css: z.string().optional(),
    role: z.string().optional(),
    /** Accessible name for `role`. */
    name: z.string().optional(),
    label: z.string().optional(),
    placeholder: z.string().optional(),
    text: z.string().optional(),
    /** Exact match for name/label/placeholder/text (default false = fuzzy). */
    exact: z.boolean().optional(),
    /** Pick the nth match when a layer is ambiguous (default 0). */
    nth: z.number().int().optional(),
    /** Natural-language description for the vision (Set-of-Marks) fallback. */
    vision: z.string().optional(),
  })
  .refine(
    (s) => Object.keys(s).some((k) => k !== "exact" && k !== "nth" && (s as Record<string, unknown>)[k] != null),
    { message: "locator must provide at least one layer (testid/css/role/label/placeholder/text/vision)" },
  );

export const fieldSchema = z
  .object({
    /** Logical name — used for degraded-match reporting + checkpoint state. */
    name: z.string(),
    action: z.enum(["fill", "type", "select", "click", "upload", "expectVisible", "expectText"]),
    locator: locateSpecSchema,
    /** For fill/type/select/expectText. Supports {{ key }} templating at run. */
    value: z.string().optional(),
    /** For upload. */
    files: z
      .array(
        z.object({
          name: z.string(),
          mimeType: z.string().optional(),
          url: z.string().optional(),
          content_base64: z.string().optional(),
        }),
      )
      .optional(),
  })
  .refine(
    (f) => {
      if (["fill", "type", "select", "expectText"].includes(f.action)) return f.value != null;
      if (f.action === "upload") return !!f.files?.length;
      return true;
    },
    { message: "fill/type/select/expectText require 'value'; upload requires 'files'" },
  );

export const stepSchema = z.object({
  id: z.string(),
  /** Optional navigation at the start of the step (relative to base_url). */
  goto: z.string().optional(),
  /** ms to wait, or a selector/testid to wait for, before the step's fields. */
  waitFor: z.union([z.number(), z.string()]).optional(),
  fields: z.array(fieldSchema).min(1),
});

/**
 * Human-like pacing (F001.9): a randomized delay before each field, drawn from
 * [min_ms, max_ms]. ONE source for the interval (the schema). Realized as a
 * `waitFor` Lens action — StoreForm never touches the browser. Real mouse-movement
 * is a cloud-Lens capability (gap filed to cardmem); StoreForm only configures it.
 */
export const pacingSchema = z
  .object({ min_ms: z.number().int().nonnegative(), max_ms: z.number().int().nonnegative() })
  .refine((p) => p.max_ms >= p.min_ms, { message: "pacing.max_ms must be >= min_ms" });

export const formSchemaSchema = z.object({
  form: z.string(),
  /** Optional default target URL; overridable per run (opts.baseUrl). */
  base_url: z.string().optional(),
  viewport: z.object({ width: z.number(), height: z.number() }).optional(),
  device: z.string().optional(),
  /** Hint that this flow mutates real target state (echoed by Lens). */
  mutates: z.boolean().optional(),
  /** Human-like pacing interval (F001.9). Applied per field as a randomized wait. */
  pacing: pacingSchema.optional(),
  steps: z.array(stepSchema).min(1),
});

export type LocateSpecInput = z.infer<typeof locateSpecSchema>;
export type FieldInput = z.infer<typeof fieldSchema>;
export type StepInput = z.infer<typeof stepSchema>;
export type PacingInput = z.infer<typeof pacingSchema>;
export type FormSchema = z.infer<typeof formSchemaSchema>;

/** Parse + validate a schema from a YAML *or* JSON string (JSON is valid YAML). */
export function parseSchema(source: string): FormSchema {
  return formSchemaSchema.parse(parseYaml(source));
}

/** Load + validate a schema file (.yaml / .yml / .json). */
export function loadSchema(path: string): FormSchema {
  return parseSchema(readFileSync(path, "utf8"));
}
