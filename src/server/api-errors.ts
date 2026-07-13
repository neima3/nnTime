/**
 * Shared API error handling — wraps DAL calls in route handlers, mapping DAL
 * exceptions to the ADR-002 error envelope.
 */
import { ConflictError, NotFoundError } from "./dal";

/** Standard error envelope per ADR-002. */
export function errorResponse(
  code: string,
  message: string,
  status: number,
  opts: { retryable?: boolean; details?: unknown } = {},
) {
  return Response.json(
    { error: { code, message, retryable: opts.retryable ?? false, ...(opts.details ? { details: opts.details } : {}) } },
    { status, headers: { "cache-control": "private, no-store" } },
  );
}

/**
 * Run a handler function and map exceptions to JSON error responses. Catches
 * the Response throws from requireSession() (401) and re-throws them.
 */
export async function handleErrors(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof ConflictError) {
      return errorResponse("conflict", e.message, 409, { retryable: true, details: e.serverState });
    }
    if (e instanceof NotFoundError) {
      return errorResponse("not_found", e.message, 404);
    }
     
    console.error("[api] unhandled error:", e);
    return errorResponse("internal", "An unexpected error occurred", 500);
  }
}

/** Parse and validate a JSON body with a zod schema, or return 400. */
export async function parseBody<T>(
  request: Request,
  schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: { message: string; issues: unknown[] } } },
): Promise<T | Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return errorResponse("bad_request", "Invalid JSON body", 400);
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    return errorResponse("bad_request", "Validation failed", 400, {
      details: result.error.issues,
    });
  }
  return result.data;
}
