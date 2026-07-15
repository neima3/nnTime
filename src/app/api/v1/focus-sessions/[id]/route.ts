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
import { z } from "zod";

const patchBody = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("transition"),
    state: z.enum(["running", "paused", "completed", "skipped", "cancelled"]),
  }),
  z.object({
    action: z.literal("extend"),
    addMinutes: z.union([z.literal(1), z.literal(5), z.literal(10)]),
  }),
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const { id } = await params;
    const body = await parseBody(request, patchBody);
    if (body instanceof Response) return body;

    try {
      let session;
      if (body.action === "transition") {
        session = await transitionFocusSession(userId, id, body.state);
        if (
          body.state === "completed" ||
          body.state === "skipped" ||
          body.state === "cancelled"
        ) {
          await appendPlannerEvent(userId, {
            entityType: "focus_session",
            entityId: id,
            eventType: "focus_stop",
            payload: {
              state: body.state,
              durationMin: session.targetDurationMin,
            },
          }).catch(() => {});
        }
      } else {
        session = await extendFocusSession(userId, id, body.addMinutes);
      }
      const remainingSec = getRemainingSec({
        state: session.state as FocusState,
        startedAt: session.startedAt,
        targetDurationMin: session.targetDurationMin,
        accumulatedPauseSec: session.accumulatedPauseSec,
        currentIntervalStartedAt: session.currentIntervalStartedAt,
      });
      return Response.json(
        { session, remainingSec },
        { headers: { "cache-control": "private, no-store" } },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "focus error";
      if (msg.includes("not found")) throw new NotFoundError("focus_session");
      if (msg.includes("illegal") || msg.includes("can only")) {
        return errorResponse("bad_request", msg, 400);
      }
      throw e;
    }
  });
}
