/**
 * PATCH /api/v1/focus-sessions/{id} — transition or extend (ADR-004).
 * Body: { action: "transition", state } | { action: "extend", addMinutes }
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors, parseBody, errorResponse } from "@/server/api-errors";
import {
  transitionFocusSession,
  extendFocusSession,
  getRemainingSec,
  type FocusState,
} from "@/server/services/focus";
import { NotFoundError, appendPlannerEvent } from "@/server/dal";
import {
  focusSessionPatchRequest,
  focusSnapshotResponse,
} from "@/server/schemas/focus-session";
import { withIdempotency } from "@/server/idempotency";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const { id } = await params;
    const ifMatch = request.headers.get("if-match");
    if (!ifMatch) {
      return errorResponse(
        "precondition_required",
        "If-Match header required",
        428,
      );
    }
    const body = await parseBody(request, focusSessionPatchRequest);
    if (body instanceof Response) return body;
    const key = request.headers.get("idempotency-key");
    const revision = Number(ifMatch);
    return withIdempotency(
      userId,
      key,
      "PATCH",
      `/api/v1/focus-sessions/${id}`,
      async (db) => {
        try {
          let session;
          if (body.action === "transition") {
            session = await transitionFocusSession(
              userId,
              id,
              body.state,
              revision,
              { db },
            );
            if (
              body.state === "completed" ||
              body.state === "skipped" ||
              body.state === "cancelled"
            ) {
              // Reuse the countdown math to log actual vs target minutes.
              const remainingSecAtStop = getRemainingSec({
                state: session.state as FocusState,
                startedAt: session.startedAt,
                targetDurationMin: session.targetDurationMin,
                accumulatedPauseSec: session.accumulatedPauseSec,
                currentIntervalStartedAt: session.currentIntervalStartedAt,
              });
              const elapsedMin = Math.max(
                0,
                Math.round(
                  (
                    session.targetDurationMin * 60 -
                    remainingSecAtStop
                  ) / 60,
                ),
              );
              await appendPlannerEvent(userId, {
                entityType: "focus_session",
                entityId: id,
                eventType: "focus_stop",
                payload: {
                  state: body.state,
                  durationMin: session.targetDurationMin,
                  targetDurationMin: session.targetDurationMin,
                  elapsedMin,
                },
              }, { db }).catch(() => {});
            }
          } else {
            session = await extendFocusSession(
              userId,
              id,
              body.addMinutes,
              revision,
              { db },
            );
          }
          const remainingSec = getRemainingSec({
            state: session.state as FocusState,
            startedAt: session.startedAt,
            targetDurationMin: session.targetDurationMin,
            accumulatedPauseSec: session.accumulatedPauseSec,
            currentIntervalStartedAt: session.currentIntervalStartedAt,
          });
          return Response.json(
            focusSnapshotResponse.parse({ session, remainingSec }),
            { headers: { "cache-control": "private, no-store" } },
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : "focus error";
          if (msg.includes("not found")) {
            throw new NotFoundError("focus_session");
          }
          if (msg.includes("illegal") || msg.includes("can only")) {
            return errorResponse("bad_request", msg, 400);
          }
          throw e;
        }
      },
    );
  });
}
