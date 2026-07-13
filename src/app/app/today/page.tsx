import {
  Check,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Plus,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  activities as mockActivities,
  catClasses,
  DAY,
  fmt,
  fmtDuration,
  inbox as mockInbox,
  NOW_MIN,
  type Activity,
} from "@/lib/mock";
import { getResolvedDay } from "@/server/services/day";
import { listCategories } from "@/server/dal";
import { buildCategoryMap, seriesToActivity, taskToInboxItem } from "@/lib/adapters";
import { TodayTimeline } from "@/components/TodayTimeline";

/**
 * Load real data for the Today screen. Falls back to mock data when the user is
 * not logged in (preserves the design reference and lets the page render for
 * visitors). ADR-002: Server Component calls the same DAL as route handlers.
 */
async function loadTodayData() {
  const resolved = await getResolvedDay();
  if (!resolved)
    return {
      activities: mockActivities,
      inbox: mockInbox,
      dayLabel: DAY.label,
      dayDate: DAY.date,
      authed: false,
    };

  // Load the user's categories for the color mapping (seeded on first access).
  const categories = await listCategories(resolved.userId).catch(() => []);
  const categoryMap = buildCategoryMap(
    categories as unknown as Parameters<typeof buildCategoryMap>[0],
  );

  // Convert series + anytime tasks to render shapes.
  const activities = (resolved.activities as Parameters<typeof seriesToActivity>[0][])
    .map((s) => seriesToActivity(s, categoryMap, resolved.zone));
  const inbox = (resolved.anytimeTasks as Parameters<typeof taskToInboxItem>[0][])
    .map((t) => taskToInboxItem(t, categoryMap));

  // Compute day label/date from the resolved date.
  const dayDate = new Date(resolved.date + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  const dayLabel = new Date(resolved.date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
  });

  return { activities, inbox, dayLabel, dayDate, authed: true };
}

const DAY_START = 7 * 60;
const DAY_END = 23 * 60;
const PX_PER_MIN = 1.7;

const top = (min: number) => (min - DAY_START) * PX_PER_MIN;

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

export default async function TodayPage() {
  const { activities, inbox, dayLabel, dayDate, authed } = await loadTodayData();
  const emptyDay = authed && activities.length === 0;

  return (
    <AppShell active="today">
      <div className="mx-auto flex max-w-5xl gap-8 px-4 py-6 md:px-8">
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
            <div className="flex items-center gap-1 rounded-2xl border border-border bg-surface p-1 shadow-card">
              <button aria-label="Previous day" className="grid size-9 place-items-center rounded-xl text-ink-soft hover:bg-surface-sunken">
                <ChevronLeft size={18} />
              </button>
              <button className="rounded-xl px-3 py-1.5 text-sm font-semibold text-iris hover:bg-iris-ghost">
                Today
              </button>
              <button aria-label="Next day" className="grid size-9 place-items-center rounded-xl text-ink-soft hover:bg-surface-sunken">
                <ChevronRight size={18} />
              </button>
            </div>
          </header>

          {emptyDay ? (
            <div className="grid place-items-center rounded-3xl border border-dashed border-border bg-surface/60 px-6 py-20 text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-iris-soft text-2xl" aria-hidden>
                ✨
              </span>
              <p className="mt-4 font-display text-xl font-bold">Your day is clear</p>
              <p className="mt-1.5 max-w-xs text-[14.5px] text-ink-soft">
                Nothing scheduled yet. Add your first activity and watch it take
                shape on the timeline.
              </p>
            </div>
          ) : (
            <TodayTimeline activities={activities} />
          )}
        </section>

        {/* right rail — desktop only */}
        <aside className="hidden w-72 shrink-0 flex-col gap-4 lg:flex">
          <div className="rounded-3xl border border-border bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Anytime</h2>
              <span className="rounded-full bg-iris-soft px-2 py-0.5 text-[12px] font-bold text-iris">
                {inbox.length}
              </span>
            </div>
            <p className="mt-1 text-[13px] text-ink-soft">
              No time pressure — drag one in when you have space.
            </p>
            <ul className="mt-4 space-y-2">
              {inbox.map((t) => {
                const cat = catClasses[t.category];
                return (
                  <li
                    key={t.id}
                    className={`flex cursor-grab items-center gap-2.5 rounded-xl px-3 py-2.5 ${cat.fill}`}
                  >
                    <span className="text-base" aria-hidden>
                      {t.emoji}
                    </span>
                    <span className={`flex-1 truncate text-[14px] font-semibold ${cat.ink}`}>
                      {t.title}
                    </span>
                    <span className={`size-5 rounded-full border-2 border-current opacity-40 ${cat.ink}`} />
                  </li>
                );
              })}
            </ul>
          </div>

          {!authed && (
            <div className="rounded-3xl bg-iris p-5 text-ink-inverse shadow-float">
              <p className="font-display text-lg font-bold leading-snug">
                Up next: Pharmacy shift prep
              </p>
              <p className="tnum mt-1 text-sm opacity-80">13:30 · in 30 min</p>
              <button className="mt-4 w-full rounded-xl bg-surface-raised/20 py-2.5 text-sm font-semibold backdrop-blur transition-colors hover:bg-surface-raised/30">
                Start early
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* FAB */}
      <button
        aria-label="Add activity"
        className="fixed bottom-24 right-5 z-40 grid size-14 place-items-center rounded-2xl bg-iris text-ink-inverse shadow-float transition-transform hover:scale-105 md:bottom-8 md:right-8"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>
    </AppShell>
  );
}
