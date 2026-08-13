/**
 * POST /api/v1/calendar/ics — import ICS feed as calendar-source activities.
 * SEC-04 SSRF controls live in fetchIcs.
 *
 * Timed events become read-only `source='calendar'` series. All-day events are
 * date-only values (ADR-001) — `activity_series` has no date-only column, so
 * they land in the app's date-only model instead: an Anytime task attached to
 * the calendar day the feed names, in the user's planning zone.
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors, parseBody, errorResponse } from "@/server/api-errors";
import { fetchIcs, parseIcs } from "@/server/services/calendar";
import { createActivitySeries, createTask, getOrCreateSettings } from "@/server/dal";
import { checkRateLimit, rateLimitedResponse } from "@/server/ratelimit";
import { z } from "zod";

const bodySchema = z.object({
  url: z.string().url().max(2000),
  /** Cap imports so a huge feed cannot fill the day. */
  maxEvents: z.number().int().min(1).max(50).optional(),
});

export async function POST(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const rl = await checkRateLimit(`calendar:ics:${userId}`, {
      limit: 10,
      windowSec: 3600,
    });
    if (!rl.allowed) return rateLimitedResponse(rl);

    const body = await parseBody(request, bodySchema);
    if (body instanceof Response) return body;

    let ics: string;
    try {
      ics = await fetchIcs(body.url);
    } catch (e) {
      console.error("[calendar/ics] fetch failed:", e);
      return errorResponse("bad_request", "Unable to import calendar", 400);
    }

    const settings = await getOrCreateSettings(userId);
    const tz = settings.timezone;
    const events = parseIcs(ics, tz).slice(0, body.maxEvents ?? 30);
    const activityIds: string[] = [];
    const taskIds: string[] = [];

    for (const ev of events) {
      const title = ev.title.slice(0, 200);
      const notes = `Imported from ICS · ${ev.uid}`;

      if (ev.allDay) {
        if (!ev.startDate) continue;
        const task = await createTask(userId, {
          bucket: "anytime",
          title,
          emoji: "📅",
          date: new Date(`${ev.startDate}T00:00:00Z`),
          notes,
        });
        taskIds.push(task.id);
        continue;
      }

      if (!ev.start) continue;
      const durationMin = Math.max(
        15,
        Math.round(
          ((ev.end?.getTime() ?? ev.start.getTime() + 60 * 60_000) -
            ev.start.getTime()) /
            60_000,
        ),
      );
      const series = await createActivitySeries(userId, {
        tz,
        dtstartLocal: ev.start,
        title,
        emoji: "📅",
        durationMin: Math.min(durationMin, 12 * 60),
        source: "calendar",
        notes,
      });
      activityIds.push(series.id);
    }

    const ids = [...activityIds, ...taskIds];
    return Response.json(
      { imported: ids.length, ids, activityIds, taskIds },
      { status: 201 },
    );
  });
}
