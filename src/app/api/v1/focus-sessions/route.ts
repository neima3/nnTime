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
import { z } from "zod";

const createBody = z.object({
  targetDurationMin: z.number().int().positive().max(24 * 60),
  activityOccurrenceId: z.string().uuid().optional(),
  title: z.string().optional(),
  emoji: z.string().optional(),
});

export async function GET() {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const session = await getActiveSession(userId);
    if (!session) {
      return Response.json(
        { session: null },
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
      { session, remainingSec },
      { headers: { "cache-control": "private, no-store" } },
    );
  });
}

export async function POST(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const body = await parseBody(request, createBody);
    if (body instanceof Response) return body;
    const session = await startFocusSession(userId, {
      targetDurationMin: body.targetDurationMin,
      activityOccurrenceId: body.activityOccurrenceId,
    });
    const remainingSec = getRemainingSec({
      state: session.state as FocusState,
      startedAt: session.startedAt,
      targetDurationMin: session.targetDurationMin,
      accumulatedPauseSec: session.accumulatedPauseSec,
      currentIntervalStartedAt: session.currentIntervalStartedAt,
    });
    return Response.json({ session, remainingSec }, { status: 201 });
  });
}
