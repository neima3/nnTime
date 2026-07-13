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

export interface AuthSession {
  userId: string;
  sessionId: string;
}

/**
 * Get the authenticated session. Returns null if not authenticated (handler
 * should return 401). Uses Better Auth's API to validate the session cookie.
 */
export async function getSession(): Promise<AuthSession | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) return null;
  return { userId: session.user.id, sessionId: session.session.id };
}

/**
 * Require an authenticated session. Throws a Response(401) if not authenticated
 * — route handlers can `await requireSession()` and let the Response propagate.
 */
export async function requireSession(): Promise<AuthSession> {
  const session = await getSession();
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
