/**
 * GET/PATCH/DELETE /api/v1/activities/{id} — ADR-001/002, SEC-01.
 * Cross-user access returns 404 (NotFoundError). If-Match required on writes.
 *
 * PATCH honors editScope (this | this_and_future | all) via the recurrence
 * service (Phase 2A + 10× Phase 1).
 */
import { requireSession } from "@/server/auth-session";
import {
  getActivitySeries,
  deleteActivitySeries,
  appendPlannerEvent,
} from "@/server/dal";
import { handleErrors, errorResponse, parseBody } from "@/server/api-errors";
import {
  activitySeriesUpdate,
  type ActivitySeriesUpdate,
} from "@/server/schemas/activity-series";
import {
  deleteSeriesOccurrence,
  editSeriesOccurrence,
} from "@/server/services/recurrence";
import { withIdempotency } from "@/server/idempotency";
import type { Db } from "@/server/dal";
import { editScopeEnum, instant, uuid } from "@/server/schemas/common";

const OCCURRENCE_ONLY_FIELDS = ["status", "startAt", "completedAt", "checklistOverride"] as const;
const MASTER_ONLY_FIELDS = [
  "tz", "dtstartLocal", "rrule", "exdate", "rdate", "emoji", "categoryId",
  "checklistTemplate", "priority", "tags", "notes", "source", "sourceRef",
] as const;

function parseRevision(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const revision = Number(value);
  return Number.isSafeInteger(revision) ? revision : null;
}

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
    const revision = parseRevision(ifMatch);
    if (revision === null) {
      return errorResponse("bad_request", "Invalid If-Match header", 400);
    }

    const idemKey = request.headers.get("idempotency-key");
    if (idemKey && !uuid.safeParse(idemKey).success) {
      return errorResponse("bad_request", "Invalid Idempotency-Key", 400);
    }

    const body = await parseBody(request, activitySeriesUpdate);
    if (body instanceof Response) return body;

    // Offline replays (ADR-002): a queued status change whose response was
    // lost must not double-apply on retry — replay the stored result instead.
    return withIdempotency(userId, idemKey, "PATCH", `/api/v1/activities/${id}`, (db) =>
      applyPatch(userId, id, revision, body, db),
    );
  });
}

async function applyPatch(
  userId: string,
  id: string,
  ifMatchRevision: number,
  body: ActivitySeriesUpdate,
  db: Db,
): Promise<Response> {
  const {
    editScope,
    occurrenceKey: occurrenceKeyRaw,
    status,
    startAt,
    completedAt,
    ...seriesFields
  } = body;

  const scope = editScope ?? "all";
  if (scope !== "all" && !occurrenceKeyRaw) {
    return errorResponse("bad_request", "occurrenceKey is required for scoped edits", 400);
  }
  const incompatible = scope === "this"
    ? MASTER_ONLY_FIELDS.find((field) => body[field] !== undefined)
    : OCCURRENCE_ONLY_FIELDS.find((field) => body[field] !== undefined);
  if (incompatible) {
    return errorResponse(
      "bad_request",
      `${incompatible} is not valid for editScope=${scope}`,
      400,
    );
  }
  const series = await getActivitySeries(userId, id, { db });
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
  if (Array.isArray(patch.exdate)) {
    patch.exdate = (patch.exdate as string[]).map(
      (date) => new Date(`${date}T00:00:00.000Z`),
    );
  }
  if (status !== undefined) patch.status = status;
  if (startAt !== undefined) patch.startAt = new Date(startAt);
  if (completedAt !== undefined) {
    patch.completedAt = completedAt === null ? null : new Date(completedAt);
  }

  const result = await editSeriesOccurrence(
    userId,
    id,
    occurrenceKey,
    scope,
    patch,
    ifMatchRevision,
    { db },
  );

  // History for stats/streaks (ADR-001 planner_events).
  if (status === "completed") {
    await appendPlannerEvent(userId, {
      entityType: "activity_series",
      entityId: result.seriesId,
      eventType: "complete",
      payload: { occurrenceKey: occurrenceKey.toISOString() },
    }, { db }).catch(() => {});
  } else if (status === "skipped") {
    await appendPlannerEvent(userId, {
      entityType: "activity_series",
      entityId: result.seriesId,
      eventType: "skip",
      payload: { occurrenceKey: occurrenceKey.toISOString() },
    }, { db }).catch(() => {});
  } else if (status === "pending") {
    // Previously this also required an explicit `completedAt: null`, so a plain
    // {status:"pending"} undo recorded nothing at all and stats kept counting
    // the completion. The occurrenceKey mirrors the `complete` payload so the
    // two can be paired per occurrence.
    await appendPlannerEvent(userId, {
      entityType: "activity_series",
      entityId: result.seriesId,
      eventType: "uncomplete",
      payload: { occurrenceKey: occurrenceKey.toISOString() },
    }, { db }).catch(() => {});
  }

  const updated = await getActivitySeries(userId, result.seriesId, { db });
  return Response.json(updated, {
    headers: {
      "cache-control": "private, no-store",
      ETag: String(updated.revision),
    },
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
    const revision = parseRevision(ifMatch);
    if (revision === null) {
      return errorResponse("bad_request", "Invalid If-Match header", 400);
    }
    const key = request.headers.get("idempotency-key");
    if (key && !uuid.safeParse(key).success) {
      return errorResponse("bad_request", "Invalid Idempotency-Key", 400);
    }
    const url = new URL(request.url);
    const scopeResult = editScopeEnum.safeParse(url.searchParams.get("editScope") ?? "this");
    if (!scopeResult.success) {
      return errorResponse("bad_request", "Invalid editScope", 400);
    }
    const scope = scopeResult.data;
    const occurrenceRaw = url.searchParams.get("occurrenceKey");
    const occurrenceResult = occurrenceRaw ? instant.safeParse(occurrenceRaw) : null;
    if (scope !== "all" && (!occurrenceResult || !occurrenceResult.success)) {
      return errorResponse(
        "bad_request",
        "A valid occurrenceKey is required for scoped deletes",
        400,
      );
    }
    if (scope === "all" && occurrenceRaw && (!occurrenceResult || !occurrenceResult.success)) {
      return errorResponse("bad_request", "Invalid occurrenceKey", 400);
    }
    const occurrenceKey = occurrenceResult?.success
      ? new Date(occurrenceResult.data)
      : null;
    const operationPath = scope === "all"
      ? `/api/v1/activities/${id}?editScope=all`
      : `/api/v1/activities/${id}?editScope=${scope}&occurrenceKey=${encodeURIComponent(occurrenceKey!.toISOString())}`;
    return withIdempotency(
      userId,
      key,
      "DELETE",
      operationPath,
      async (db) => {
        if (scope === "all") {
          await deleteActivitySeries(userId, id, revision, { db });
        } else {
          await deleteSeriesOccurrence(
            userId,
            id,
            occurrenceKey!,
            scope,
            revision,
            { db },
          );
        }
        return new Response(null, { status: 204 });
      },
    );
  });
}
