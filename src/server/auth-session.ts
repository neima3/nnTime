/**
 * Auth session helper for route handlers — ADR-003/005 SEC-01.
 *
 * Every /api/v1 handler calls `requireSession()` to get the authenticated
 * userId. Returns 401 if unauthenticated. The userId is then passed into every
 * DAL function so queries are scoped per-resource.
 */
import "server-only";
import { headers } from "next/headers";
import { auth } from "./auth";
import { ensureMigrated } from "./db/migrate-on-startup";
import {
  assertQueueOwner,
  QUEUE_OWNER_HEADER,
} from "@/lib/queue-ownership";

export interface AuthSession {
  userId: string;
  sessionId: string;
  user: { id: string; name: string | null; email: string };
}

/**
 * Raised when the database is provisioned but unreachable. Distinct from "not
 * authenticated" on purpose: collapsing the two made a transient DB blip look
 * like a sign-out, so a signed-in user's real day was silently replaced by the
 * demo "Sample planner" and every API call answered 401 instead of 5xx.
 */
export class SessionUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Session store unavailable");
    this.name = "SessionUnavailableError";
    this.cause = cause;
  }
}

/**
 * Next signals control flow with thrown errors: `headers()` throws
 * DYNAMIC_SERVER_USAGE to bail a page out of static prerendering, and
 * redirect()/notFound() throw NEXT_REDIRECT/NEXT_HTTP_ERROR_FALLBACK. They all
 * carry a `digest`, and React's PPR postpone is a tagged object. Swallowing any
 * of them turns a normal bail-out into a build failure, so they pass straight
 * through.
 */
function isFrameworkSignal(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if (typeof (error as { digest?: unknown }).digest === "string") return true;
  return (
    (error as { $$typeof?: symbol }).$$typeof === Symbol.for("react.postpone")
  );
}

/**
 * Get the authenticated session. Returns null when the request is genuinely
 * unauthenticated, and also when DATABASE_URL is unset — that is the infra-setup
 * case where Server Components intentionally fall back to the sample planner.
 *
 * Throws `SessionUnavailableError` when the database IS configured but failing,
 * so callers surface an error instead of presenting mock data as the user's own.
 */
export async function getSession(): Promise<AuthSession | null> {
  try {
    await ensureMigrated(); // guarantee tables exist before querying
    const requestHeaders = await headers();
    const session = await auth.api.getSession({
      headers: requestHeaders,
    });
    if (!session?.user?.id) return null;
    assertQueueOwner(
      session.user.id,
      requestHeaders.get(QUEUE_OWNER_HEADER),
    );
    return {
      userId: session.user.id,
      sessionId: session.session.id,
      user: {
        id: session.user.id,
        name: session.user.name ?? null,
        email: session.user.email,
      },
    };
  } catch (error) {
    if (error instanceof Response) throw error;
    if (isFrameworkSignal(error)) throw error;
    // No database provisioned yet — stay lenient so the design reference renders.
    if (!process.env.DATABASE_URL) return null;
    throw new SessionUnavailableError(error);
  }
}

/**
 * Require an authenticated session. Throws a Response(401) if not authenticated
 * — route handlers can `await requireSession()` and let the Response propagate.
 */
export async function requireSession(): Promise<AuthSession> {
  let session: AuthSession | null;
  try {
    session = await getSession();
  } catch (error) {
    if (error instanceof Response) throw error;
    if (error instanceof SessionUnavailableError) {
      throw new Response(
        JSON.stringify({
          error: {
            code: "service_unavailable",
            message: "Service temporarily unavailable",
            retryable: true,
          },
        }),
        {
          status: 503,
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
            "retry-after": "5",
          },
        },
      );
    }
    throw error;
  }
  if (!session) {
    throw new Response(
      JSON.stringify({
        error: { code: "unauthorized", message: "Authentication required", retryable: false },
      }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }
  return session;
}
