/**
 * GET/PATCH/DELETE /api/v1/routines/{id}
 */
import { requireSession } from "@/server/auth-session";
import {
  getRoutine,
  updateRoutine,
  deleteRoutine,
  listRoutineSteps,
  listRoutineSchedules,
} from "@/server/dal";
import { handleErrors, parseBody, errorResponse } from "@/server/api-errors";
import { routineUpdate } from "@/server/schemas/routine";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const { id } = await params;
    const routine = await getRoutine(userId, id);
    const steps = await listRoutineSteps(userId, id);
    const schedules = await listRoutineSchedules(userId, id);
    return Response.json(
      { ...routine, steps, schedules },
      {
        headers: {
          "cache-control": "private, no-store",
          ETag: String(routine.revision),
        },
      },
    );
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
    const body = await parseBody(request, routineUpdate);
    if (body instanceof Response) return body;
    const updated = await updateRoutine(userId, id, body, Number(ifMatch));
    return Response.json(updated, {
      headers: { ETag: String(updated.revision) },
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
    await deleteRoutine(userId, id, Number(ifMatch));
    return new Response(null, { status: 204 });
  });
}
