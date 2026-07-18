/**
 * POST /api/v1/ai/plan-day — SEC-05 proposal only; no auto-mutation.
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors, parseBody, errorResponse } from "@/server/api-errors";
import { planMyDay } from "@/server/services/ai";
import { listTasks } from "@/server/dal";
import { z } from "zod";

const bodySchema = z.object({
  energy: z.enum(["low", "medium", "high"]).default("medium"),
  freeSlots: z
    .array(z.object({ start: z.string(), end: z.string() }))
    .max(20)
    .optional(),
});

export async function POST(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const body = await parseBody(request, bodySchema);
    if (body instanceof Response) return body;
    if (!process.env.ANTHROPIC_API_KEY) {
      return errorResponse(
        "service_unavailable",
        "AI is not configured (missing ANTHROPIC_API_KEY).",
        503,
      );
    }
    const tasks = await listTasks(userId, { bucket: "inbox" });
    const anytime = await listTasks(userId, { bucket: "anytime" });
    const combined = [...tasks, ...anytime].slice(0, 20).map((t) => ({
      id: t.id,
      title: t.title,
      energy: t.energy ?? undefined,
    }));
    if (combined.length === 0) {
      return Response.json({
        items: [],
        message: "No inbox/anytime tasks to plan — add a few first.",
      });
    }
    try {
      const slots = body.freeSlots ?? [
        { start: "09:00", end: "12:00" },
        { start: "13:00", end: "17:00" },
      ];
      const result = await planMyDay(userId, combined, body.energy, slots);
      const titleById = new Map(combined.map((t) => [t.id, t.title]));
      const items = result.items.map((it) => ({
        ...it,
        title: titleById.get(it.taskId) ?? it.taskId,
      }));
      return Response.json({ ...result, items });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI error";
      if (msg.includes("quota")) {
        return errorResponse("rate_limited", "Daily AI quota exceeded", 429, {
          retryable: true,
        });
      }
      console.error("[ai/plan-day]", e);
      return errorResponse("internal", "An unexpected error occurred", 500);
    }
  });
}
