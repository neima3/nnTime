/**
 * GET /api/v1/day/{YYYY-MM-DD} — ADR-001/002.
 * Same resolution path as the Today Server Component (no self-HTTP).
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors, errorResponse } from "@/server/api-errors";
import { getResolvedDay } from "@/server/services/day";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  return handleErrors(async () => {
    await requireSession();
    const { date } = await params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return errorResponse("bad_request", "date must be YYYY-MM-DD", 400);
    }
    const resolved = await getResolvedDay(date);
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
