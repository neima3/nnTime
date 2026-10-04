/**
 * POST /api/v1/ai/group-priority — SEC-05 suggestion only.
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors, errorResponse } from "@/server/api-errors";
import { groupByPriority, AI_MAX_TASKS } from "@/server/services/ai";
import { mapAiRouteError } from "../map-ai-route-error";
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
    // Quota caps request count, not payload size: only the oldest AI_MAX_TASKS
    // inbox items go to the model (same cap plan-day uses).
    const considered = tasks.slice(0, AI_MAX_TASKS);
    try {
      const result = await groupByPriority(
        userId,
        considered.map((t) => ({ id: t.id, title: t.title })),
      );
      return Response.json({
        ...result,
        consideredCount: considered.length,
        totalCount: tasks.length,
        truncated: tasks.length > considered.length,
      });
    } catch (e) {
      return mapAiRouteError(e, "[ai/group-priority]");
    }
  });
}
