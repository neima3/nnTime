/**
 * POST /api/v1/batch — ADR-002 ordered operations (not all-or-nothing).
 *
 * Self-HTTP fan-out: each op is re-fetched against the same origin with the
 * caller's cookies. Full in-process dispatch is deferred; self-HTTP is kept
 * for now with path denylist + rate limit (safer than an incomplete dispatcher).
 * Deny nested /api/v1/batch; cap ops at 50; rate-limit 30 batches/min per user.
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors, parseBody, errorResponse } from "@/server/api-errors";
import { batchRequest } from "@/server/schemas/batch";
import { checkRateLimit, rateLimitedResponse } from "@/server/ratelimit";
import { isAllowedBatchPath, normalizeBatchPath } from "./path";

export async function POST(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const rl = await checkRateLimit(`api:batch:${userId}`, {
      limit: 30,
      windowSec: 60,
    });
    if (!rl.allowed) return rateLimitedResponse(rl);

    const body = await parseBody(request, batchRequest);
    if (body instanceof Response) return body;

    if (body.operations.length > 50) {
      return errorResponse("bad_request", "Max 50 operations per batch", 400);
    }

    const cookie = request.headers.get("cookie") ?? "";
    const origin = new URL(request.url).origin;
    const results: { status: number; body: unknown }[] = [];

    for (const op of body.operations) {
      const path = normalizeBatchPath(op.path);
      if (!isAllowedBatchPath(path)) {
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
        // Self-HTTP only for allowlisted /api/v1/* paths (see path.ts denylist).
        const res = await fetch(`${origin}${path}`, {
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
      } catch {
        results.push({
          status: 500,
          body: {
            error: {
              code: "internal",
              message: "batch op failed",
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
