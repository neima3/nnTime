import { AppShell } from "@/components/AppShell";
import { SignedInOnly } from "@/components/AppSessionBoundary";
import { StatsClient } from "@/components/StatsClient";
import { BrainBreaksCard } from "@/components/BrainBreaksCard";
import { SignedOutCard } from "@/components/EmptyState";
import { BarChart3 } from "lucide-react";

export default function StatsPage() {
  return (
    <AppShell active="stats">
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
        <header className="mb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Insights
          </h1>
          <p className="mt-1 text-[14px] text-ink-soft">
            Gentle numbers — they describe, they don&apos;t judge.
          </p>
        </header>
        <SignedInOnly
          fallback={
            <SignedOutCard
              icon={BarChart3}
              art="stats-seed"
              title="See your gentle numbers"
              body="Completions, focus time, soft streaks, and mood — described, never judged. Sign in to start collecting yours."
              returnTo="/app/stats"
            />
          }
        >
          <StatsClient />
        </SignedInOnly>
        <div className="mt-4">
          <BrainBreaksCard />
        </div>
      </div>
    </AppShell>
  );
}
