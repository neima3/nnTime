import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Plus,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  activities as mockActivities,
  DAY,
  inbox as mockInbox,
  NOW_MIN,
  type Activity,
} from "@/lib/mock";
import { getResolvedDay } from "@/server/services/day";
import { listCategories } from "@/server/dal";
import { buildCategoryMap, seriesToActivity, taskToInboxItem } from "@/lib/adapters";
import { TodayTimeline } from "@/components/TodayTimeline";
import { SoftStreaks } from "@/components/SoftStreaks";
import { AmbientSounds } from "@/components/AmbientSounds";
import { ToastHost } from "@/components/Toast";
import { AnytimeRail } from "@/components/AnytimeRail";
import { instantToDateStr } from "@/server/temporal/zone";

function shiftDate(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + deltaDays));
  return dt.toISOString().slice(0, 10);
}

function formatDayLabel(dateStr: string, zone: string) {
  // Use noon UTC so the calendar date is stable across zones for labels.
  const instant = new Date(`${dateStr}T12:00:00Z`);
  const dayLabel = instant.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: zone,
  });
  const dayDate = instant.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: zone,
  });
  return { dayLabel, dayDate };
}

/**
 * Load real data for the Today screen. Falls back to mock data when the user is
 * not logged in (preserves the design reference).
 */
async function loadTodayData(dateParam?: string) {
  const resolved = await getResolvedDay(dateParam);
  if (!resolved)
    return {
      activities: mockActivities,
      inbox: mockInbox.map((t) => ({ ...t, revision: 1 })),
      dayLabel: DAY.label,
      dayDate: DAY.date,
      date: "mock",
      zone: "UTC",
      authed: false,
      isToday: true,
      nowMin: NOW_MIN,
    };

  const categories = await listCategories(resolved.userId).catch(() => []);
  const categoryMap = buildCategoryMap(
    categories as unknown as Parameters<typeof buildCategoryMap>[0],
  );

  const activities = (
    resolved.activities as Parameters<typeof seriesToActivity>[0][]
  ).map((s) => {
    const status = resolved.occurrenceStatusBySeries[s.id];
    return seriesToActivity(s, categoryMap, resolved.zone, {
      done: status === "completed",
    });
  });

  const inbox = (
    resolved.anytimeTasks as Parameters<typeof taskToInboxItem>[0][]
  ).map((t) => taskToInboxItem(t, categoryMap));

  const { dayLabel, dayDate } = formatDayLabel(resolved.date, resolved.zone);
  const todayInZone = instantToDateStr(new Date(), resolved.zone);
  const isToday = resolved.date === todayInZone;

  return {
    activities,
    inbox,
    dayLabel,
    dayDate,
    date: resolved.date,
    zone: resolved.zone,
    authed: true,
    isToday,
    nowMin: isToday ? NOW_MIN : 0, // client LiveNowLine handles live time
  };
}

function DayProgress({ activities }: { activities: Activity[] }) {
  const done = activities.filter((a) => a.done).length;
  const pct = activities.length ? Math.round((done / activities.length) * 100) : 0;
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface px-3.5 py-2 shadow-card">
      <svg width="38" height="38" viewBox="0 0 38 38" className="-rotate-90">
        <circle cx="19" cy="19" r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
        <circle
          cx="19"
          cy="19"
          r={r}
          fill="none"
          stroke="var(--iris)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <div>
        <p className="tnum text-sm font-bold leading-none">{pct}%</p>
        <p className="mt-0.5 text-[11px] font-medium text-ink-soft">
          {done} of {activities.length} done
        </p>
      </div>
    </div>
  );
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const dateParam = typeof sp.date === "string" ? sp.date : undefined;
  const {
    activities,
    inbox,
    dayLabel,
    dayDate,
    date,
    zone,
    authed,
    isToday,
    nowMin,
  } = await loadTodayData(dateParam);

  const emptyDay = authed && activities.length === 0;
  const prevDate = date !== "mock" ? shiftDate(date, -1) : undefined;
  const nextDate = date !== "mock" ? shiftDate(date, 1) : undefined;

  return (
    <AppShell active="today">
      <ToastHost />
      <div className="timeline-scroll-container mx-auto flex max-w-5xl gap-8 px-4 py-6 md:px-8">
        <section className="min-w-0 flex-1">
          <header className="mb-6 flex flex-wrap items-center gap-3">
            <div className="mr-auto">
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-iris">
                {dayLabel}
              </p>
              <h1 className="font-display text-3xl font-bold tracking-tight">
                {dayDate}
              </h1>
            </div>
            {!emptyDay && <DayProgress activities={activities} />}
            <SoftStreaks />
            {authed && (
              <Link
                href="/app/review"
                className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-surface px-3 py-2 text-[13px] font-semibold text-ink-soft shadow-card hover:bg-surface-sunken hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
              >
                <ListChecks size={15} />
                Review
              </Link>
            )}
            <div className="flex items-center gap-1 rounded-2xl border border-border bg-surface p-1 shadow-card">
              {prevDate ? (
                <Link
                  href={`/app/today?date=${prevDate}`}
                  aria-label="Previous day"
                  className="grid size-9 place-items-center rounded-xl text-ink-soft hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
                >
                  <ChevronLeft size={18} />
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  aria-label="Previous day"
                  className="grid size-9 place-items-center rounded-xl text-ink-soft opacity-40"
                >
                  <ChevronLeft size={18} />
                </button>
              )}
              <Link
                href="/app/today"
                className={`rounded-xl px-3 py-1.5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none ${
                  isToday
                    ? "bg-iris-ghost text-iris"
                    : "text-iris hover:bg-iris-ghost"
                }`}
              >
                Today
              </Link>
              {nextDate ? (
                <Link
                  href={`/app/today?date=${nextDate}`}
                  aria-label="Next day"
                  className="grid size-9 place-items-center rounded-xl text-ink-soft hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
                >
                  <ChevronRight size={18} />
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  aria-label="Next day"
                  className="grid size-9 place-items-center rounded-xl text-ink-soft opacity-40"
                >
                  <ChevronRight size={18} />
                </button>
              )}
            </div>
          </header>

          {emptyDay ? (
            <div className="grid place-items-center rounded-3xl border border-dashed border-border bg-surface/60 px-6 py-20 text-center">
              <span
                className="grid size-14 place-items-center rounded-2xl bg-iris-soft text-2xl"
                aria-hidden
              >
                ✨
              </span>
              <p className="mt-4 font-display text-xl font-bold">Your day is clear</p>
              <p className="mt-1.5 max-w-xs text-[14.5px] text-ink-soft">
                Nothing scheduled yet. Add your first activity and watch it take
                shape on the timeline.
              </p>
              <Link
                href={`/app/editor?date=${date}&start=${9 * 60}`}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-iris px-5 py-2.5 text-sm font-semibold text-ink-inverse shadow-card hover:bg-iris-deep focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
              >
                <Plus size={16} />
                Add activity
              </Link>
            </div>
          ) : (
            <TodayTimeline
              activities={activities}
              date={date === "mock" ? new Date().toISOString().slice(0, 10) : date}
              zone={zone}
              nowMin={nowMin}
              isToday={isToday}
              authed={authed}
            />
          )}
        </section>

        <aside className="rise-in hidden w-72 shrink-0 flex-col gap-4 lg:flex" style={{ animationDelay: "120ms" }}>
          <AnytimeRail
            items={inbox.map((t) => ({
              id: t.id,
              title: t.title,
              emoji: t.emoji,
              category: t.category,
              revision: "revision" in t ? Number(t.revision) : 1,
            }))}
            date={date === "mock" ? new Date().toISOString().slice(0, 10) : date}
            authed={authed}
          />

          {!authed && (
            <div className="rounded-3xl bg-iris p-5 text-ink-inverse shadow-float">
              <p className="font-display text-lg font-bold leading-snug">
                Up next: Pharmacy shift prep
              </p>
              <p className="tnum mt-1 text-sm opacity-80">13:30 · in 30 min</p>
              <Link
                href="/sign-in"
                className="mt-4 block w-full rounded-xl bg-surface-raised/20 py-2.5 text-center text-sm font-semibold backdrop-blur transition-colors hover:bg-surface-raised/30"
              >
                Sign in to plan
              </Link>
            </div>
          )}
          <div className="rounded-3xl border border-border bg-surface p-4 shadow-card">
            <h3 className="mb-2 font-display text-sm font-bold">Focus sounds</h3>
            <AmbientSounds />
          </div>
        </aside>
      </div>

      <Link
        href={
          date !== "mock"
            ? `/app/editor?date=${date}&start=${13 * 60}`
            : "/app/editor"
        }
        aria-label="Add activity"
        className="fixed bottom-24 right-5 z-40 grid size-14 place-items-center rounded-2xl bg-iris text-ink-inverse shadow-float transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none md:bottom-8 md:right-8"
      >
        <Plus size={26} strokeWidth={2.5} />
      </Link>
    </AppShell>
  );
}
