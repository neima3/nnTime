import { AppShell } from "@/components/AppShell";
import { FocusClient } from "@/components/FocusClient";

export default async function FocusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const title =
    typeof sp.title === "string" ? sp.title : "Deep focus";
  const emoji = typeof sp.emoji === "string" ? sp.emoji : "🎯";
  const duration =
    typeof sp.duration === "string" && Number(sp.duration) > 0
      ? Number(sp.duration)
      : 25;
  const activityId =
    typeof sp.activityId === "string" ? sp.activityId : undefined;
  const occurrenceKey =
    typeof sp.occurrenceKey === "string" ? sp.occurrenceKey : undefined;

  return (
    <AppShell active="focus">
      <FocusClient
        defaultTitle={title}
        defaultEmoji={emoji}
        defaultDurationMin={duration}
        activityId={activityId}
        occurrenceKey={occurrenceKey}
      />
    </AppShell>
  );
}
