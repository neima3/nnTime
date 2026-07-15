/**
 * POST /api/v1/calendar/ics — import ICS feed as calendar-source activities.
 * SEC-04 SSRF controls live in fetchIcs.
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors, parseBody, errorResponse } from "@/server/api-errors";
import { fetchIcs, parseIcs } from "@/server/services/calendar";
import { createActivitySeries, getOrCreateSettings } from "@/server/dal";
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
      return errorResponse(
        "bad_request",
        e instanceof Error ? e.message : "ICS fetch failed",
        400,
      );
    }

    const events = parseIcs(ics).slice(0, body.maxEvents ?? 30);
    const settings = await getOrCreateSettings(userId);
    const tz = settings.timezone;
    const created: string[] = [];

    for (const ev of events) {
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
        title: ev.title.slice(0, 200),
        emoji: "📅",
        durationMin: Math.min(durationMin, 12 * 60),
        source: "calendar",
        notes: `Imported from ICS · ${ev.uid}`,
      });
      created.push(series.id);
    }

    return Response.json(
      { imported: created.length, ids: created },
      { status: 201 },
    );
  });
}
