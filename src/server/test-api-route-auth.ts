/**
 * Helpers for /api/v1 route integration tests — real Better Auth sessions
 * against an ephemeral Postgres (Task 4.1 auth boundary matrix).
 */
import { parseSetCookieHeader } from "better-auth/cookies";
import type { Auth } from "./auth";

const SESSION_COOKIE = "better-auth.session_token";

export function cookieHeaderFromSetCookie(
  setCookieHeader: string | null | undefined,
): string {
  const signed = parseSetCookieHeader(setCookieHeader ?? "").get(
    SESSION_COOKIE,
  )?.value;
  if (!signed) {
    throw new Error("Better Auth did not return a session_token Set-Cookie");
  }
  return `${SESSION_COOKIE}=${signed}`;
}

export async function signUpTestUser(
  auth: Auth,
  body: { email: string; password: string; name: string },
): Promise<{ userId: string; cookieHeader: string }> {
  const signUp = await auth.api.signUpEmail({ body });
  const userId = signUp.user?.id;
  if (!userId) {
    throw new Error("signUpEmail did not return a user id");
  }

  const signIn = await auth.api.signInEmail({
    body: { email: body.email, password: body.password },
    returnHeaders: true,
  });
  const cookieHeader = cookieHeaderFromSetCookie(
    signIn.headers?.get("set-cookie"),
  );
  return { userId, cookieHeader };
}
