/**
 * GET /api/v1/activities/{id}/occurrences — ADR-001/002, SEC-01.
 * Lists materialized occurrences for a series. Parent ownership verified in
 * listOccurrences (nested-resource SEC-01 check).
 */
import { requireSession } from "@/server/auth-session";
import { listOccurrences } from "@/server/dal";
import { handleErrors } from "@/server/api-errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const { id } = await params;
    const occurrences = await listOccurrences(userId, id);
    return Response.json(
      { items: occurrences },
      { headers: { "cache-control": "private, no-store" } },
    );
  });
}
