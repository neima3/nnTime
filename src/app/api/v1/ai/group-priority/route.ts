/**
 * POST /api/v1/ai/group-priority — SEC-05 suggestion only.
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors, errorResponse } from "@/server/api-errors";
import { groupByPriority } from "@/server/services/ai";
import { listTasks } from "@/server/dal";

export async function POST() {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    if (!process.env.ANTHROPIC_API_KEY) {
      return errorResponse(
        "service_unavailable",
        "AI is not configured (missing ANTHROPIC_API_KEY).",
        503,
      );
    }
    const tasks = await listTasks(userId, { bucket: "inbox" });
    if (tasks.length === 0) {
      return Response.json({ groups: [], message: "Inbox is empty." });
    }
    try {
      const result = await groupByPriority(
        userId,
        tasks.map((t) => ({ id: t.id, title: t.title })),
      );
      return Response.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI error";
      if (msg.includes("quota")) {
        return errorResponse("rate_limited", "Daily AI quota exceeded", 429, {
          retryable: true,
        });
      }
      console.error("[ai/group-priority]", e);
      return errorResponse("internal", "An unexpected error occurred", 500);
    }
  });
}
