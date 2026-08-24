/**
 * POST /api/v1/client-errors — 6.2 `client_error_reports` (ADR-005 SEC-01/03/05/06).
 *
 * Fire-and-forget sink for browser-side crash telemetry (window.onerror /
 * unhandledrejection — see src/components/ClientErrorReporter.tsx). Auth
 * like every other /api/v1 route; the session userId is the only owner the
 * row can ever get — no client-supplied `userId` field exists in the body
 * schema, and the DAL takes userId as its own argument regardless.
 *
 * `message`/`stack`/`path` are redacted (src/server/redact.ts) before the
 * insert — Authorization headers, Bearer tokens, cookies, token=/key= query
 * secrets, and ICS/webcal URLs never reach the database.
 *
 * `release` is stamped from a server-only build-SHA env var if one reaches
 * this container. Kairo's Dockerfile does not currently thread one through
 * (see its comment on the NEXT_PUBLIC_ VAPID-key trap this repo already hit
 * once): a NEXT_PUBLIC_ var would ship as `undefined` at request time, so we
 * deliberately do not use one here. Until a real build arg exists, `release`
 * stays null rather than lying about the build.
 *
 * Always responds 204 — never echoes the stored row back to the client.
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors, parseBody } from "@/server/api-errors";
import { createClientErrorReport } from "@/server/dal";
import { redactClientErrorReport } from "@/server/redact";
import { checkRateLimit, rateLimitedResponse } from "@/server/ratelimit";
import { clientErrorReportRequest } from "@/server/schemas";

/** Server-only build identifier, if the runtime image ever carries one. */
const RELEASE = process.env.KAIRO_RELEASE ?? null;

export async function POST(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const rl = await checkRateLimit(`api:client-errors:${userId}`, {
      limit: 10,
      windowSec: 60,
    });
    if (!rl.allowed) return rateLimitedResponse(rl);

    const body = await parseBody(request, clientErrorReportRequest);
    if (body instanceof Response) return body;

    const redacted = redactClientErrorReport({
      message: body.message,
      stack: body.stack ?? null,
      path: body.path ?? null,
    });

    await createClientErrorReport(userId, {
      name: body.name,
      message: redacted.message,
      stack: redacted.stack,
      path: redacted.path,
      release: RELEASE,
    });

    return new Response(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
  });
}
