/**
 * GET /api/v1/day/{YYYY-MM-DD}?tz=<iana> — ADR-001/002.
 * Resolves the day in the user's planning zone (or ?tz override).
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors, errorResponse } from "@/server/api-errors";
import { getResolvedDay } from "@/server/services/day";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  return handleErrors(async () => {
    await requireSession();
    const { date } = await params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return errorResponse("bad_request", "date must be YYYY-MM-DD", 400);
    }
    // Optional tz override from query param (ADR-001: defaults to user's zone).
    const url = new URL(request.url);
    const tzOverride = url.searchParams.get("tz") || undefined;
    const resolved = await getResolvedDay(date, { tzOverride });
    if (!resolved) {
      return errorResponse("unauthorized", "Not authenticated", 401);
    }
    return Response.json(
      {
        date: resolved.date,
        zone: resolved.zone,
        start: resolved.start.toISOString(),
        end: resolved.end.toISOString(),
        activities: resolved.activities,
        anytimeTasks: resolved.anytimeTasks,
        occurrenceStatusBySeries: resolved.occurrenceStatusBySeries,
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  });
}
