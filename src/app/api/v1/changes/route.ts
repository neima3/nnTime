/**
 * GET /api/v1/changes?cursor=&limit= — ADR-002 incremental sync feed.
 * Returns change_log rows (including tombstones) ordered by per-user sequence.
 */
import { requireSession } from "@/server/auth-session";
import { getChanges } from "@/server/dal";
import { handleErrors } from "@/server/api-errors";

export async function GET(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const url = new URL(request.url);
    const cursor = Number(url.searchParams.get("cursor") ?? "0");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 500);
    const result = await getChanges(userId, cursor, limit);
    return Response.json(result, { headers: { "cache-control": "private, no-store" } });
  });
}
