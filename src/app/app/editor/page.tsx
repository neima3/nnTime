import { AppShell } from "@/components/AppShell";
import { SignedInOnly } from "@/components/AppSessionBoundary";
import { ActivityEditor } from "@/components/ActivityEditor";
import { SignedOutCard } from "@/components/EmptyState";
import { CalendarPlus } from "lucide-react";

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
  const start = typeof sp.start === "string" ? Number(sp.start) : undefined;
  const date = typeof sp.date === "string" ? sp.date : undefined;
  const title = typeof sp.title === "string" ? sp.title : undefined;

  return (
    <AppShell active="today">
      <SignedInOnly
        fallback={
          <div className="mx-auto max-w-2xl px-4 py-10 md:px-8">
            <SignedOutCard
              icon={CalendarPlus}
              title="Plan after you sign in"
              body="Create activities, choose gentle reminders, and keep your plan synced across devices."
            />
          </div>
        }
      >
        <ActivityEditor
          mode={id ? "edit" : "create"}
          activityId={id}
          initialStartMin={
            Number.isFinite(start) ? (start as number) : undefined
          }
          initialDate={date}
          initialTitle={title}
        />
      </SignedInOnly>
    </AppShell>
  );
}
