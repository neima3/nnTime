/**
 * DELETE /api/v1/privacy/account — SEC-10 account deletion cascade.
 * Requires header Confirm: delete-my-account.
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors, errorResponse } from "@/server/api-errors";
import { deleteAccount } from "@/server/services/privacy";

export async function DELETE(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const confirm = request.headers.get("confirm");
    if (confirm !== "delete-my-account") {
      return errorResponse(
        "precondition_required",
        'Send header Confirm: delete-my-account',
        428,
      );
    }
    await deleteAccount(userId);

    // Deleting the user cascades its session rows away, but Better Auth's
    // cookieCache (5 min) resolves a session straight from the signed cookie
    // without touching the database — so the deleted account stayed "signed in"
    // and the planner answered 500 (settings/day tried to write rows for a user
    // id that no longer exists) instead of 401. Expire the session cookies with
    // the response so the client is signed out the moment deletion succeeds.
    const response = new Response(null, { status: 204 });
    for (const name of SESSION_COOKIE_NAMES) {
      response.headers.append("set-cookie", expireCookie(name));
    }
    return response;
  });
}

/** Both the session token and the cookie-cache payload, plain and __Secure-. */
const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "better-auth.session_data",
  "__Secure-better-auth.session_token",
  "__Secure-better-auth.session_data",
];

function expireCookie(name: string): string {
  const secure = name.startsWith("__Secure-") ? "; Secure" : "";
  return `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${secure}`;
}
