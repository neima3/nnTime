export type RoutineEditorStep = {
  title: string;
  durationMin?: number | null;
};

export type RoutineCreatedPayload = {
  id: string;
  title: string;
  emoji?: string | null;
  revision?: number;
  steps?: RoutineEditorStep[];
  scheduleId?: string;
  scheduleRevision?: number;
  schedules?: { id: string; revision: number }[];
};

export function routineToEditorDefaults(
  routine: { title: string; emoji?: string | null },
  steps: RoutineEditorStep[],
) {
  const totalMin = steps.reduce((sum, step) => sum + (step.durationMin ?? 0), 0);
  return {
    initialTitle: routine.title,
    initialEmoji: routine.emoji ?? undefined,
    initialSteps: steps.map((step) => ({ label: step.title, done: false })),
    initialDurationMin: totalMin > 0 ? totalMin : undefined,
  };
}

export function createdRoutineToView(
  created: RoutineCreatedPayload,
  submittedSteps: RoutineEditorStep[],
) {
  const steps = created.steps ?? submittedSteps;
  const schedule = created.schedules?.[0];
  return {
    id: created.id,
    title: created.title,
    emoji: created.emoji ?? "🔁",
    stepCount: steps.length,
    totalMin: steps.reduce((sum, step) => sum + (step.durationMin ?? 0), 0),
    revision: created.revision ?? 1,
    paused: false,
    scheduleId: created.scheduleId ?? schedule?.id,
    scheduleRevision: created.scheduleRevision ?? schedule?.revision,
    rruleLabel: "Daily" as const,
  };
}
