/**
 * POST /api/v1/push/test — send the current user a test nudge so they can
 * confirm reminders work right after subscribing (F1). SEC-01 user-scoped.
 */
import { requireSession } from "@/server/auth-session";
import { sendToUser, pushConfigured } from "@/server/services/push";
import { handleErrors, errorResponse } from "@/server/api-errors";

export async function POST() {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    if (!pushConfigured()) {
      return errorResponse(
        "service_unavailable",
        "Push is not configured on the server.",
        503,
      );
    }
    const result = await sendToUser(userId, {
      title: "Kairo reminders are on ✨",
      body: "This is what a gentle nudge feels like. You're all set.",
      tag: "kairo-test",
      url: "/app/today",
    });
    return Response.json(result);
  });
}
