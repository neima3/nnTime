/**
 * GET/POST /api/v1/routines — SEC-01.
 */
import { requireSession } from "@/server/auth-session";
import {
  listRoutines,
  createRoutine,
  listRoutineSteps,
  listRoutineSchedules,
  createRoutineSchedule,
} from "@/server/dal";
import { handleErrors, parseBody } from "@/server/api-errors";
import { z } from "zod";

const createBody = z.object({
  title: z.string().min(1).max(200),
  emoji: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  notes: z.string().optional(),
  steps: z
    .array(
      z.object({
        title: z.string(),
        durationMin: z.number().int().nullish(),
      }),
    )
    .optional(),
  schedule: z
    .object({
      tz: z.string().min(1),
      rrule: z.string().nullable().optional(),
      paused: z.boolean().optional(),
    })
    .optional(),
});

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
      { items },
      { headers: { "cache-control": "private, no-store" } },
    );
  });
}

export async function POST(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const body = await parseBody(request, createBody);
    if (body instanceof Response) return body;
    const routine = await createRoutine(userId, {
      title: body.title,
      emoji: body.emoji,
      categoryId: body.categoryId,
      notes: body.notes,
      steps: body.steps,
    });
    if (body.schedule) {
      await createRoutineSchedule(userId, {
        routineId: routine.id,
        tz: body.schedule.tz,
        rrule: body.schedule.rrule,
        paused: body.schedule.paused,
      });
    }
    return Response.json(routine, { status: 201 });
  });
}
