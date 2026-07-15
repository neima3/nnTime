/**
 * PATCH /api/v1/routines/{id}/schedules/{scheduleId} — pause/resume.
 */
import { requireSession } from "@/server/auth-session";
import { updateRoutineSchedule, getRoutine } from "@/server/dal";
import { handleErrors, parseBody, errorResponse } from "@/server/api-errors";
import { z } from "zod";

const bodySchema = z.object({
  paused: z.boolean().optional(),
  rrule: z.string().nullable().optional(),
  tz: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; scheduleId: string }> },
) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const { id, scheduleId } = await params;
    await getRoutine(userId, id); // ownership
    const ifMatch = request.headers.get("if-match");
    if (!ifMatch) {
      return errorResponse("precondition_required", "If-Match header required", 428);
    }
    const body = await parseBody(request, bodySchema);
    if (body instanceof Response) return body;
    const updated = await updateRoutineSchedule(
      userId,
      scheduleId,
      body,
      Number(ifMatch),
    );
    return Response.json(updated);
  });
}
