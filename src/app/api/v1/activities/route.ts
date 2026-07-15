/**
 * GET/POST /api/v1/activities — ADR-001/002, SEC-01.
 * Activity series master records (ADR-001 recurrence). Every query scoped by
 * session userId.
 */
import { requireSession } from "@/server/auth-session";
import { listActivitySeries, createActivitySeries } from "@/server/dal";
import { handleErrors, parseBody } from "@/server/api-errors";
import { activitySeriesCreate } from "@/server/schemas/activity-series";
import { checkRateLimit, rateLimitedResponse } from "@/server/ratelimit";

export async function GET() {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const series = await listActivitySeries(userId);
    return Response.json({ items: series }, { headers: { "cache-control": "private, no-store" } });
  });
}

export async function POST(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const rl = await checkRateLimit(`api:activities:create:${userId}`, {
      limit: 60,
      windowSec: 60,
    });
    if (!rl.allowed) return rateLimitedResponse(rl);
    const body = await parseBody(request, activitySeriesCreate);
    if (body instanceof Response) return body;
    const series = await createActivitySeries(userId, {
      tz: body.tz,
      dtstartLocal: new Date(body.dtstartLocal),
      rrule: body.rrule ?? null,
      title: body.title,
      emoji: body.emoji,
      categoryId: body.categoryId,
      durationMin: body.durationMin,
      energy: body.energy ?? null,
      priority: body.priority,
      notes: body.notes,
      source: body.source,
      checklistTemplate: body.checklistTemplate,
    });
    return Response.json(series, { status: 201 });
  });
}
