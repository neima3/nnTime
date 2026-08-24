/**
 * Client error report wire contract — 6.2 `client_error_reports`.
 *
 * POST /api/v1/client-errors body. Deliberately trims + truncates instead of
 * rejecting at the cap: this is best-effort telemetry from a browser that is
 * already failing, not a resource the user is trying to save — a 400 here
 * just means the crash report itself gets lost. `userId`/`release` are never
 * accepted from the client (release is stamped server-side; see the route).
 */
import { z } from "zod";

/**
 * Trim, then hard-cap length by truncating (never throws on overlong input).
 * The trailing `.max(max)` never actually rejects — the transform already
 * guarantees the output fits — it exists so `z.toJSONSchema` emits the same
 * `maxLength` the OpenAPI component documents (checked by
 * request-openapi-contract.test.ts).
 */
function trimmedAndCapped(max: number) {
  return z
    .string()
    .transform((s) => s.trim().slice(0, max))
    .pipe(z.string().max(max));
}

export const clientErrorReportRequest = z.object({
  name: trimmedAndCapped(120),
  message: trimmedAndCapped(2000),
  stack: trimmedAndCapped(8000).optional(),
  path: trimmedAndCapped(500).optional(),
});

export type ClientErrorReportRequest = z.infer<typeof clientErrorReportRequest>;
