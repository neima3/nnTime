import { AppShell } from "@/components/AppShell";
import { ActivityEditor } from "@/components/ActivityEditor";

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
      <ActivityEditor
        mode={id ? "edit" : "create"}
        activityId={id}
        initialStartMin={
          Number.isFinite(start) ? (start as number) : undefined
        }
        initialDate={date}
        initialTitle={title}
      />
    </AppShell>
  );
}
