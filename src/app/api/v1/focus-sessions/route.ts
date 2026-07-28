/**
 * GET/POST /api/v1/focus-sessions — ADR-004, SEC-01.
 * GET returns the active session (if any) + remainingSec.
 * POST starts a new session (yields any existing active session).
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors, parseBody } from "@/server/api-errors";
import {
  startFocusSession,
  getActiveSession,
  getRemainingSec,
  type FocusState,
} from "@/server/services/focus";
import { appendPlannerEvent } from "@/server/dal";
import {
  focusSessionCreateRequest,
  focusSnapshotResponse,
} from "@/server/schemas/focus-session";
import { withIdempotency } from "@/server/idempotency";

export async function GET() {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const session = await getActiveSession(userId);
    if (!session) {
      return Response.json(
        focusSnapshotResponse.parse({ session: null }),
        { headers: { "cache-control": "private, no-store" } },
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
  });
}

export async function POST(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const body = await parseBody(request, focusSessionCreateRequest);
    if (body instanceof Response) return body;
    const key = request.headers.get("idempotency-key");
    return withIdempotency(
      userId,
      key,
      "POST",
      "/api/v1/focus-sessions",
      async (db) => {
        const session = await startFocusSession(
          userId,
          {
            targetDurationMin: body.targetDurationMin,
            activityOccurrenceId: body.activityOccurrenceId,
          },
          { db },
        );
        await appendPlannerEvent(userId, {
          entityType: "focus_session",
          entityId: session.id,
          eventType: "focus_start",
          payload: {
            targetDurationMin: body.targetDurationMin,
            title: body.title,
          },
        }, { db }).catch(() => {});
        const remainingSec = getRemainingSec({
          state: session.state as FocusState,
          startedAt: session.startedAt,
          targetDurationMin: body.targetDurationMin,
          accumulatedPauseSec: session.accumulatedPauseSec,
          currentIntervalStartedAt: session.currentIntervalStartedAt,
        });
        return Response.json(
          focusSnapshotResponse.parse({ session, remainingSec }),
          {
            status: 201,
            headers: { "cache-control": "private, no-store" },
          },
        );
      },
    );
  });
}
