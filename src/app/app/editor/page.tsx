import { AppShell } from "@/components/AppShell";
import { SignedInOnly } from "@/components/AppSessionBoundary";
import { ActivityEditor } from "@/components/ActivityEditor";
import { SignedOutCard } from "@/components/EmptyState";
import { CalendarPlus } from "lucide-react";
import { getSession } from "@/server/auth-session";
import {
  getTask,
  listCategories,
  listChecklistItems,
  getRoutine,
  listRoutineSteps,
} from "@/server/dal";
import { buildCategoryMap } from "@/lib/adapters";
import { appReturnTo } from "@/lib/auth-return";
import { routineToEditorDefaults } from "@/lib/routine-editor-defaults";

/**
 * Activity editor route — create (?start=&date=) or edit (?id=).
 * DESIGN: Soft Focus modal/sheet per design-spec.
 */
export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const id = typeof sp.id === "string" ? sp.id : undefined;
  const taskId = typeof sp.taskId === "string" ? sp.taskId : undefined;
  const routineId = typeof sp.routineId === "string" ? sp.routineId : undefined;
  const start = typeof sp.start === "string" ? Number(sp.start) : undefined;
  const date = typeof sp.date === "string" ? sp.date : undefined;
  const title = typeof sp.title === "string" ? sp.title : undefined;
  // ADR-001 occurrence identity: which day of a repeating series is open. The
  // editor needs it to offer "just this time" instead of rewriting the series.
  const occurrenceKey =
    typeof sp.occurrenceKey === "string" ? sp.occurrenceKey : undefined;
  const repeats = sp.repeats === "1";
  const returnTo = appReturnTo("/app/editor", {
    id,
    taskId,
    routineId,
    start: Number.isFinite(start) ? start : undefined,
    date,
    title,
    occurrenceKey,
    repeats: repeats ? "1" : undefined,
  });
  const session = await getSession();
  const task =
    session && taskId
      ? await getTask(session.userId, taskId).catch(() => null)
      : null;
  const routine =
    session && routineId
      ? await getRoutine(session.userId, routineId).catch(() => null)
      : null;
  const routineSteps =
    session && routine
      ? await listRoutineSteps(session.userId, routine.id).catch(() => [])
      : [];
  const routineDefaults = routine
    ? routineToEditorDefaults(routine, routineSteps)
    : null;
  const categories = session
    ? await listCategories(session.userId)
    : [];
  const checklist =
    session && task
      ? await listChecklistItems(session.userId, "task", task.id).catch(() => [])
      : [];
  const categoryKey = task?.categoryId
    ? buildCategoryMap(
        categories as unknown as Parameters<typeof buildCategoryMap>[0],
      ).get(task.categoryId)
    : undefined;

  return (
    <AppShell active="today">
      <SignedInOnly
        fallback={
          <div className="mx-auto max-w-2xl px-4 py-10 md:px-8">
            <SignedOutCard
              icon={CalendarPlus}
              title="Plan after you sign in"
              body="Create activities, choose gentle reminders, and keep your plan synced across devices."
              returnTo={returnTo}
              headingLevel="h1"
            />
          </div>
        }
      >
        <ActivityEditor
          mode={id ? "edit" : "create"}
          activityId={id}
          sourceTaskId={id ? undefined : taskId}
          initialStartMin={
            Number.isFinite(start) ? (start as number) : undefined
          }
          initialDate={date}
          initialOccurrenceKey={occurrenceKey}
          initialRepeats={repeats}
          initialTitle={task?.title ?? routineDefaults?.initialTitle ?? title}
          initialEmoji={
            task?.emoji ?? routineDefaults?.initialEmoji ?? undefined
          }
          initialDurationMin={routineDefaults?.initialDurationMin}
          initialCategoryKey={categoryKey}
          initialCategoryId={task?.categoryId ?? undefined}
          initialCategories={categories.map(({ id, key, label }) => ({
            id,
            key,
            label,
          }))}
          initialEnergy={task?.energy ?? undefined}
          initialPriority={task?.priority ?? undefined}
          initialNotes={task?.notes ?? undefined}
          initialSteps={
            checklist.length
              ? checklist.map((item) => ({
                  label: item.label,
                  done: item.done,
                }))
              : routineDefaults?.initialSteps
          }
        />
      </SignedInOnly>
    </AppShell>
  );
}
