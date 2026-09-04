import { AppShell } from "@/components/AppShell";
import { SignedInOnly } from "@/components/AppSessionBoundary";
import { SignedOutCard } from "@/components/EmptyState";
import { FocusClient } from "@/components/FocusClient";
import { appReturnTo } from "@/lib/auth-return";
import { normalizeFocusDuration } from "@/lib/focus-duration";
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
  const duration = normalizeFocusDuration(sp.duration);
  const activityId =
    typeof sp.activityId === "string" ? sp.activityId : undefined;
  const occurrenceKey =
    typeof sp.occurrenceKey === "string" ? sp.occurrenceKey : undefined;
  const returnTo = appReturnTo("/app/focus", {
    title,
    emoji,
    duration,
    activityId,
    occurrenceKey,
  });

  return (
    <AppShell active="focus">
      <SignedInOnly
        fallback={
          <div className="mx-auto max-w-2xl px-4 py-10 md:px-8">
            <SignedOutCard
              icon={Timer}
              art="focus-ring"
              title="Focus after you sign in"
              body="Start a session, keep the timer in sync, and return to it from any Kairo screen."
              returnTo={returnTo}
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
