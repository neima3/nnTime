/**
 * GET/POST /api/v1/activities — ADR-001/002, SEC-01.
 * Activity series master records (ADR-001 recurrence). Every query scoped by
 * session userId.
 */
import { requireSession } from "@/server/auth-session";
import { listActivitySeries, createActivitySeries } from "@/server/dal";
import { errorResponse, handleErrors, parseBody } from "@/server/api-errors";
import { activitySeriesCreate } from "@/server/schemas/activity-series";
import { uuid } from "@/server/schemas/common";
import { checkRateLimit, rateLimitedResponse } from "@/server/ratelimit";
import { withIdempotency } from "@/server/idempotency";

export async function GET() {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const series = await listActivitySeries(userId);
    return Response.json(
      { items: series, nextCursor: null },
      { headers: { "cache-control": "private, no-store" } },
    );
  });
}

export async function POST(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const key = request.headers.get("idempotency-key");
    if (key && !uuid.safeParse(key).success) {
      return errorResponse("bad_request", "Invalid Idempotency-Key", 400);
    }
    const rl = await checkRateLimit(`api:activities:create:${userId}`, {
      limit: 60,
      windowSec: 60,
    });
    if (!rl.allowed) return rateLimitedResponse(rl);
    return withIdempotency(userId, key, "POST", "/api/v1/activities", async (db) => {
      const body = await parseBody(request, activitySeriesCreate);
      if (body instanceof Response) return body;
      const series = await createActivitySeries(userId, {
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
      }, { db });
      return Response.json(series, {
        status: 201,
        headers: { "cache-control": "private, no-store" },
      });
    });
  });
}
