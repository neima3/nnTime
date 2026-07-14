/**
 * GET/PATCH/DELETE /api/v1/activities/{id} — ADR-001/002, SEC-01.
 * Cross-user access returns 404 (NotFoundError). If-Match required on writes.
 *
 * PATCH honors editScope (this | this_and_future | all) via the recurrence
 * service (Phase 2A + 10× Phase 1).
 */
import { requireSession } from "@/server/auth-session";
import { getActivitySeries, deleteActivitySeries } from "@/server/dal";
import { handleErrors, errorResponse, parseBody } from "@/server/api-errors";
import { activitySeriesUpdate } from "@/server/schemas/activity-series";
import { editSeriesOccurrence } from "@/server/services/recurrence";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const { id } = await params;
    const series = await getActivitySeries(userId, id);
    return Response.json(series, {
      headers: {
        "cache-control": "private, no-store",
        ETag: String(series.revision),
      },
    });
  });
}

export async function PATCH(
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

    const body = await parseBody(request, activitySeriesUpdate);
    if (body instanceof Response) return body;

    const {
      editScope,
      occurrenceKey: occurrenceKeyRaw,
      status,
      startAt,
      completedAt,
      ...seriesFields
    } = body;

    const scope = editScope ?? "all";
    const series = await getActivitySeries(userId, id);
    const occurrenceKey = occurrenceKeyRaw
      ? new Date(occurrenceKeyRaw)
      : series.dtstartLocal;

    // Coerce ISO strings → Date for DB columns.
    const patch: Record<string, unknown> = { ...seriesFields };
    if (typeof patch.dtstartLocal === "string") {
      patch.dtstartLocal = new Date(patch.dtstartLocal);
    }
    if (Array.isArray(patch.rdate)) {
      patch.rdate = (patch.rdate as string[]).map((d) => new Date(d));
    }
    if (status !== undefined) patch.status = status;
    if (startAt !== undefined) patch.startAt = new Date(startAt);
    if (completedAt !== undefined) {
      patch.completedAt = completedAt === null ? null : new Date(completedAt);
    }

    await editSeriesOccurrence(
      userId,
      id,
      occurrenceKey,
      scope,
      patch,
      Number(ifMatch),
    );

    // For this_and_future the "current" series may be the truncated original;
    // clients re-fetch the day. For all/this return the still-current master.
    const updated = await getActivitySeries(userId, id);
    return Response.json(updated, {
      headers: {
        "cache-control": "private, no-store",
        ETag: String(updated.revision),
      },
    });
  });
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
