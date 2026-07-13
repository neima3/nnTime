/**
 * GET/PATCH/DELETE /api/v1/activities/{id} — ADR-001/002, SEC-01.
 * Cross-user access returns 404 (NotFoundError). If-Match required on DELETE.
 *
 * PATCH (with editScope) lands in Phase 2A — this handler returns 501 until
 * the series-split / this-and-future logic exists.
 */
import { requireSession } from "@/server/auth-session";
import { getActivitySeries, deleteActivitySeries } from "@/server/dal";
import { handleErrors, errorResponse } from "@/server/api-errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const { id } = await params;
    const series = await getActivitySeries(userId, id);
    return Response.json(series, { headers: { "cache-control": "private, no-store" } });
  });
}

export async function PATCH() {
  // editScope (ADR-001: this / this_and_future / all) lands in Phase 2A along
  // with the series-split materializer. Surface a clear 501 until then.
  return errorResponse("not_implemented", "edit scopes land in Phase 2A", 501);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const { id } = await params;
    const ifMatch = request.headers.get("if-match");
    if (!ifMatch) {
      return errorResponse("precondition_required", "If-Match header required", 428);
    }
    await deleteActivitySeries(userId, id, Number(ifMatch));
    return new Response(null, { status: 204 });
  });
}
