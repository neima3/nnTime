import { requireSession } from "@/server/auth-session";
import { errorResponse, handleErrors, parseBody } from "@/server/api-errors";
import { scheduleTask } from "@/server/dal";
import { withIdempotency } from "@/server/idempotency";
import { checkRateLimit, rateLimitedResponse } from "@/server/ratelimit";
import { activitySeriesCreate } from "@/server/schemas/activity-series";
import { uuid } from "@/server/schemas/common";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const { id } = await params;
    if (!uuid.safeParse(id).success) {
      return errorResponse("bad_request", "Invalid task id", 400);
    }
    const key = request.headers.get("idempotency-key");
    if (key && !uuid.safeParse(key).success) {
      return errorResponse("bad_request", "Invalid Idempotency-Key", 400);
    }
    const rl = await checkRateLimit(`api:tasks:schedule:${userId}`, {
      limit: 60,
      windowSec: 60,
    });
    if (!rl.allowed) return rateLimitedResponse(rl);
    const path = `/api/v1/tasks/${id}/schedule`;
    return withIdempotency(userId, key, "POST", path, async (db) => {
      const body = await parseBody(request, activitySeriesCreate);
      if (body instanceof Response) return body;
      const series = await scheduleTask(
        userId,
        id,
        {
          tz: body.tz,
          dtstartLocal: new Date(body.dtstartLocal),
          rrule: body.rrule ?? null,
          exdate: body.exdate?.map((date) => new Date(`${date}T00:00:00.000Z`)),
          rdate: body.rdate?.map((date) => new Date(date)),
          title: body.title,
          emoji: body.emoji,
          categoryId: body.categoryId,
          durationMin: body.durationMin,
          energy: body.energy ?? null,
          priority: body.priority,
          tags: body.tags,
          notes: body.notes,
          source: body.source,
          sourceRef: body.sourceRef,
          checklistTemplate: body.checklistTemplate,
        },
        { db },
      );
      return Response.json(series, {
        status: 201,
        headers: { "cache-control": "private, no-store" },
      });
    });
  });
}
