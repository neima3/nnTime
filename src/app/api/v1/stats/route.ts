/**
 * GET /api/v1/stats?days=7 — planner_events aggregates (Phase 5C / Wave 2).
 */
import { requireSession } from "@/server/auth-session";
import { errorResponse, handleErrors } from "@/server/api-errors";
import { getStats } from "@/server/services/stats";
import { statsQuery, statsResponse } from "@/server/schemas/stats";

export async function GET(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const url = new URL(request.url);
    const requestedDays = url.searchParams.getAll("days");
    if (requestedDays.length > 1) {
      return errorResponse("bad_request", "Validation failed", 400, {
        details: [
          {
            code: "custom",
            path: ["days"],
            message: "days must be provided at most once",
          },
        ],
      });
    }
    const query = statsQuery.safeParse({
      days: requestedDays[0],
    });
    if (!query.success) {
      return errorResponse("bad_request", "Validation failed", 400, {
        details: query.error.issues,
      });
    }
    const { days } = query.data;
    const to = new Date();
    const from = new Date(Date.now() - days * 86400000);
    const stats = await getStats(userId, { from, to });
    const response = statsResponse.parse({
      ...stats,
      from: from.toISOString(),
      to: to.toISOString(),
      days,
    });
    return Response.json(
      response,
      { headers: { "cache-control": "private, no-store" } },
    );
  });
}
