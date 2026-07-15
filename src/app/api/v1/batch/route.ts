/**
 * POST /api/v1/batch — ADR-002 ordered operations (not all-or-nothing).
 * Dispatches to internal handlers via request reconstruction on same origin.
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors, parseBody, errorResponse } from "@/server/api-errors";
import { batchRequest } from "@/server/schemas/batch";

const ALLOWED_PREFIX = "/api/v1/";

export async function POST(request: Request) {
  return handleErrors(async () => {
    await requireSession(); // ensure auth before fan-out
    const body = await parseBody(request, batchRequest);
    if (body instanceof Response) return body;

    if (body.operations.length > 50) {
      return errorResponse("bad_request", "Max 50 operations per batch", 400);
    }

    const cookie = request.headers.get("cookie") ?? "";
    const origin = new URL(request.url).origin;
    const results: { status: number; body: unknown }[] = [];

    for (const op of body.operations) {
      if (!op.path.startsWith(ALLOWED_PREFIX) || op.path.includes("..")) {
        results.push({
          status: 400,
          body: { error: { code: "bad_request", message: "Invalid path" } },
        });
        continue;
      }
      try {
        const headers: Record<string, string> = {
          cookie,
          "content-type": "application/json",
        };
        if (op.idempotencyKey) headers["idempotency-key"] = op.idempotencyKey;
        const res = await fetch(`${origin}${op.path}`, {
          method: op.method,
          headers,
          body:
            op.method === "DELETE" || op.body === undefined
              ? undefined
              : JSON.stringify(op.body),
        });
        let resBody: unknown = null;
        const text = await res.text();
        if (text) {
          try {
            resBody = JSON.parse(text);
          } catch {
            resBody = text;
          }
        }
        results.push({ status: res.status, body: resBody });
      } catch (e) {
        results.push({
          status: 500,
          body: {
            error: {
              code: "internal",
              message: e instanceof Error ? e.message : "batch op failed",
            },
          },
        });
      }
    }

    return Response.json(
      { results },
      { headers: { "cache-control": "private, no-store" } },
    );
  });
}
