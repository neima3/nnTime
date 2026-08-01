import { AppShell } from "@/components/AppShell";
import { SignedInOnly } from "@/components/AppSessionBoundary";
import { SignedOutCard } from "@/components/EmptyState";
import { FocusClient } from "@/components/FocusClient";
import { Timer } from "lucide-react";

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
      <SignedInOnly
        fallback={
          <div className="mx-auto max-w-2xl px-4 py-10 md:px-8">
            <SignedOutCard
              icon={Timer}
              title="Focus after you sign in"
              body="Start a session, keep the timer in sync, and return to it from any Kairo screen."
              headingLevel="h1"
            />
          </div>
        }
      >
        <FocusClient
          defaultTitle={title}
          defaultEmoji={emoji}
          defaultDurationMin={duration}
          activityId={activityId}
          occurrenceKey={occurrenceKey}
        />
      </SignedInOnly>
    </AppShell>
  );
}
