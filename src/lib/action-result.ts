import type { z } from "zod";

export type FieldErrors = Record<string, string>;

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

/** Flattens Zod issues to { "lines.0.description": "message" } for inline errors. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    result[key] ??= issue.message;
  }
  return result;
}

export function invalid(error: z.ZodError): { ok: false; error: string; fieldErrors: FieldErrors } {
  return { ok: false, error: "Revisa los campos marcados.", fieldErrors: toFieldErrors(error) };
}
