import { AppShell } from "@/components/AppShell";
import { StatsClient } from "@/components/StatsClient";

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
        <StatsClient />
      </div>
    </AppShell>
  );
}
