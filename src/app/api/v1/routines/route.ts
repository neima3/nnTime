/**
 * GET/POST /api/v1/routines — SEC-01.
 */
import { requireSession } from "@/server/auth-session";
import {
  listRoutines,
  createRoutine,
  listRoutineSteps,
  listRoutineSchedules,
} from "@/server/dal";
import { handleErrors, parseBody } from "@/server/api-errors";
import { routineCreate } from "@/server/schemas/routine";

export async function GET() {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const routines = await listRoutines(userId);
    const items = await Promise.all(
      routines.map(async (r) => {
        const steps = await listRoutineSteps(userId, r.id);
        const schedules = await listRoutineSchedules(userId, r.id);
        return {
          ...r,
          steps,
          schedules,
          stepCount: steps.length,
          totalMin: steps.reduce((s, x) => s + (x.durationMin ?? 0), 0),
        };
      }),
    );
    return Response.json(
      { items, nextCursor: null },
      { headers: { "cache-control": "private, no-store" } },
    );
  });
}

export async function POST(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const body = await parseBody(request, routineCreate);
    if (body instanceof Response) return body;
    const routine = await createRoutine(userId, {
      title: body.title,
      emoji: body.emoji,
      categoryId: body.categoryId,
      notes: body.notes,
      steps: body.steps,
      schedule: body.schedule,
    });
    return Response.json(routine, { status: 201 });
  });
}
