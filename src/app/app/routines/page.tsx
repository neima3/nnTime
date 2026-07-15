import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RoutinesClient, type RoutineView } from "@/components/RoutinesClient";
import { ToastHost } from "@/components/Toast";
import { getSession } from "@/server/auth-session";
import {
  listRoutines,
  listRoutineSteps,
  listRoutineSchedules,
} from "@/server/dal";
import { routines as mockRoutines } from "@/lib/mock";

async function load(): Promise<{ items: RoutineView[]; authed: boolean }> {
  const session = await getSession();
  if (!session) {
    return {
      authed: false,
      items: mockRoutines.map((r) => ({
        id: r.id,
        title: r.title,
        emoji: r.emoji,
        stepCount: r.steps,
        totalMin: r.minutes,
        revision: 1,
        paused: false,
        rruleLabel: r.days,
      })),
    };
  }
  const routines = await listRoutines(session.userId);
  const items: RoutineView[] = await Promise.all(
    routines.map(async (r) => {
      const steps = await listRoutineSteps(session.userId, r.id);
      const schedules = await listRoutineSchedules(session.userId, r.id);
      const sched = schedules[0];
      return {
        id: r.id,
        title: r.title,
        emoji: r.emoji ?? "📋",
        stepCount: steps.length,
        totalMin: steps.reduce((s, x) => s + (x.durationMin ?? 0), 0),
        revision: r.revision,
        paused: sched?.paused ?? false,
        scheduleId: sched?.id,
        scheduleRevision: sched?.revision,
        rruleLabel: sched?.rrule
          ? sched.rrule.includes("DAILY")
            ? "Daily"
            : sched.rrule.includes("WEEKLY")
              ? "Weekly"
              : "Custom"
          : "Unscheduled",
      };
    }),
  );
  return { items, authed: true };
}

export default async function RoutinesPage() {
  const { items, authed } = await load();
  return (
    <AppShell active="routines">
      <ToastHost />
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        <header className="mb-2 flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Routines
            </h1>
            <p className="mt-1 text-[14px] text-ink-soft">
              Sequences you can drop into any day — pause anytime.
            </p>
          </div>
          <Link
            href="/app/templates"
            className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-iris shadow-card hover:bg-iris-ghost"
          >
            <Sparkles size={16} />
            Browse templates
          </Link>
        </header>
        <RoutinesClient initial={items} authed={authed} />
      </div>
    </AppShell>
  );
}
