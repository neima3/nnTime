/**
 * GET /api/v1/stats?days=7 — planner_events aggregates (Phase 5C / Wave 2).
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors } from "@/server/api-errors";
import { getStats } from "@/server/services/stats";

export async function GET(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const url = new URL(request.url);
    const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") ?? "14")));
    const to = new Date();
    const from = new Date(Date.now() - days * 86400000);
    const stats = await getStats(userId, { from, to });
    return Response.json(
      { ...stats, from: from.toISOString(), to: to.toISOString(), days },
      { headers: { "cache-control": "private, no-store" } },
    );
  });
}
