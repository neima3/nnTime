import { AppShell } from "@/components/AppShell";
import { SignedInOnly } from "@/components/AppSessionBoundary";
import { ActivityEditor } from "@/components/ActivityEditor";
import { SignedOutCard } from "@/components/EmptyState";
import { CalendarPlus } from "lucide-react";
import { getSession } from "@/server/auth-session";
import { getTask, listCategories, listChecklistItems } from "@/server/dal";
import { buildCategoryMap } from "@/lib/adapters";

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
  const start = typeof sp.start === "string" ? Number(sp.start) : undefined;
  const date = typeof sp.date === "string" ? sp.date : undefined;
  const title = typeof sp.title === "string" ? sp.title : undefined;
  const session = taskId ? await getSession() : null;
  const task =
    session && taskId
      ? await getTask(session.userId, taskId).catch(() => null)
      : null;
  const [categories, checklist] =
    session && task
      ? await Promise.all([
          listCategories(session.userId).catch(() => []),
          listChecklistItems(session.userId, "task", task.id).catch(() => []),
        ])
      : [[], []];
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
          initialTitle={task?.title ?? title}
          initialEmoji={task?.emoji ?? undefined}
          initialCategoryKey={categoryKey}
          initialCategoryId={task?.categoryId ?? undefined}
          initialEnergy={task?.energy ?? undefined}
          initialPriority={task?.priority ?? undefined}
          initialNotes={task?.notes ?? undefined}
          initialSteps={checklist.map((item) => ({
            label: item.label,
            done: item.done,
          }))}
        />
      </SignedInOnly>
    </AppShell>
  );
}
