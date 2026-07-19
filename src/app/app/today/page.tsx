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
  fmt,
  inbox as mockInbox,
  NOW_MIN,
  type Activity,
} from "@/lib/mock";
import { getResolvedDay } from "@/server/services/day";
import { listCategories } from "@/server/dal";
import {
  buildCategoryMap,
  dateToMinutesFromMidnight,
  seriesToActivity,
  taskToInboxItem,
} from "@/lib/adapters";
import { TodayTimeline } from "@/components/TodayTimeline";
import { TimezoneNudge } from "@/components/TimezoneNudge";
import { PickForMe, type PickCandidate } from "@/components/PickForMe";
import { DayRituals } from "@/components/DayRituals";
import { LowBatteryNote, LowBatteryToggle } from "@/components/LowBattery";
import { DayDoneRain } from "@/components/DayDoneRain";
import { SoftStreaks } from "@/components/SoftStreaks";
import { AmbientSounds } from "@/components/AmbientSounds";
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
      // Empty zone → live now-line falls back to the visitor's browser clock
      // (a fixed zone would show the demo's "now" at the wrong time of day).
      zone: "",
      authed: false,
      isToday: true,
      nowMin: NOW_MIN,
    };

  const categories = await listCategories(resolved.userId).catch(() => []);
  const categoryMap = buildCategoryMap(
    categories as unknown as Parameters<typeof buildCategoryMap>[0],
  );

  const activities = resolved.activities.map((s) =>
    seriesToActivity(s, categoryMap, resolved.zone, {
      done: s.status === "completed",
      occurrenceKey: s.occurrenceKey.toISOString(),
    }),
  );

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

/**
 * Day-load meter (10× ADHD Phase 8 — pre-commitment over post-hoc nagging).
 * Planned minutes vs the 7:00–23:00 waking window, three honest bands, and a
 * gentle escape hatch to the review flow when the day feels full.
 */
function DayLoadMeter({ activities }: { activities: Activity[] }) {
  const plannedMin = activities.reduce((sum, a) => sum + a.duration, 0);
  if (plannedMin === 0) return null;
  const windowMin = 16 * 60;
  const pct = Math.min(100, Math.round((plannedMin / windowMin) * 100));
  const band = pct < 40 ? "light" : pct <= 70 ? "comfortable" : "full";
  const hours =
    plannedMin % 60 === 0
      ? `${plannedMin / 60} h`
      : `${(plannedMin / 60).toFixed(1)} h`;
  const label =
    band === "light"
      ? `${hours} planned · a light day`
      : band === "comfortable"
        ? `${hours} planned · a comfortable day`
        : `${hours} planned · that's a lot for one day`;
  return (
    <div className="mb-5 flex items-center gap-3">
      <div
        className="h-1.5 max-w-48 flex-1 overflow-hidden rounded-full bg-surface-sunken"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Day load: ${label}`}
      >
        <div
          className={`h-full rounded-full ${
            band === "full" ? "bg-cat-butter-ink" : "bg-iris"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[12.5px] font-medium text-ink-soft">{label}</p>
      {band === "full" && (
        <Link
          href="/app/review"
          className="text-[12.5px] font-bold text-iris hover:underline"
        >
          Lighten it →
        </Link>
      )}
    </div>
  );
}

function DayProgress({ activities }: { activities: Activity[] }) {
  const done = activities.filter((a) => a.done).length;
  const pct = activities.length ? Math.round((done / activities.length) * 100) : 0;
  const complete = pct === 100;
  const halfway = pct >= 50 && !complete;
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <div
      className={`flex items-center gap-2.5 rounded-2xl border px-3.5 py-2 shadow-card ${
        complete
          ? "border-success/30 bg-success-soft"
          : "border-border bg-surface"
      }`}
    >
      <svg width="38" height="38" viewBox="0 0 38 38" className="-rotate-90">
        <circle cx="19" cy="19" r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
        <circle
          cx="19"
          cy="19"
          r={r}
          fill="none"
          stroke={complete ? "var(--success)" : "var(--iris)"}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 0.6s var(--ease-spring)" }}
        />
      </svg>
      <div>
        <p
          className={`tnum text-sm font-bold leading-none ${
            complete ? "text-success" : ""
          }`}
        >
          {complete ? "Done!" : `${pct}%`}
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-ink-soft">
          {complete
            ? `all ${activities.length} done`
            : halfway
              ? `${done} of ${activities.length} · halfway there`
              : `${done} of ${activities.length} done`}
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

  // Real "Up next" rail card (authed, viewing today): the earliest activity
  // that is not done and hasn't fully passed. Mock card covers signed-out.
  const nowMinutes =
    authed && isToday ? dateToMinutesFromMidnight(new Date(), zone) : null;
  const upNext =
    nowMinutes != null
      ? [...activities]
          .filter((a) => !a.done && a.start + a.duration > nowMinutes)
          .sort((a, b) => a.start - b.start)[0]
      : undefined;
  const upNextIsCurrent =
    upNext != null && nowMinutes != null && upNext.start <= nowMinutes;
  const upNextMeta =
    upNext != null && nowMinutes != null
      ? upNextIsCurrent
        ? `${fmt(upNext.start)} · ${upNext.start + upNext.duration - nowMinutes} min left`
        : `${fmt(upNext.start)} · in ${upNext.start - nowMinutes} min`
      : "";
  const focusParams = upNext
    ? new URLSearchParams({
        title: upNext.title,
        emoji: upNext.emoji,
        duration: String(upNext.duration),
        activityId: upNext.id,
      }).toString()
    : "";

  // "Pick for me" candidates: now → next → slipped-today → loose tasks.
  const pickCandidates: PickCandidate[] =
    nowMinutes != null
      ? [
          ...activities
            .filter((a) => !a.done)
            .map((a): PickCandidate => {
              const end = a.start + a.duration;
              const kind =
                a.start <= nowMinutes && nowMinutes < end
                  ? ("now" as const)
                  : a.start > nowMinutes
                    ? ("next" as const)
                    : ("slipped" as const);
              return {
                id: a.id,
                title: a.title,
                emoji: a.emoji,
                kind,
                durationMin: Math.min(a.duration, 60),
                energy: a.energy ?? null,
              };
            }),
          ...inbox.map(
            (t): PickCandidate => ({
              id: t.id,
              title: t.title,
              emoji: t.emoji,
              kind: "task",
              durationMin: 25,
            }),
          ),
        ]
      : [];

  return (
    <AppShell active="today">
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
            {authed && isToday && <LowBatteryToggle date={date} />}
            {authed && isToday && (
              <PickForMe candidates={pickCandidates} date={date} />
            )}
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

          {authed && <TimezoneNudge zone={zone} />}

          {authed && isToday && <LowBatteryNote date={date} />}

          {authed && !activities.every((a) => a.done) && (
            <DayLoadMeter activities={activities} />
          )}

          {authed && isToday && (
            <DayRituals
              zone={zone}
              date={date}
              activityCount={activities.length}
              unfinished={activities
                .filter((a) => !a.done)
                .map((a) => ({
                  id: a.id,
                  revision: a.revision ?? 1,
                  occurrenceKey: a.occurrenceKey ?? "",
                  startMin: a.start,
                }))}
            />
          )}

          {authed &&
            activities.length > 0 &&
            activities.every((a) => a.done) && (
              <>
              <DayDoneRain date={date} />
              <div className="mb-5 flex items-center gap-3 rounded-2xl border border-success/30 bg-success-soft px-4 py-3.5">
                <span className="text-xl" aria-hidden>
                  🎉
                </span>
                <div>
                  <p className="text-[14.5px] font-bold text-success">
                    Day done — everything happened.
                  </p>
                  <p className="text-[13px] font-medium text-ink-soft">
                    Nothing left to carry. Go be free.
                  </p>
                </div>
              </div>
              </>
            )}

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

          {authed && upNext && (
            <div className="rounded-3xl bg-iris p-5 text-ink-inverse shadow-float">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-80">
                {upNextIsCurrent ? "Happening now" : "Up next"}
              </p>
              <p className="mt-1 font-display text-lg font-bold leading-snug">
                <span aria-hidden>{upNext.emoji}</span> {upNext.title}
              </p>
              <p className="tnum mt-1 text-sm opacity-80">{upNextMeta}</p>
              <Link
                href={`/app/focus?${focusParams}`}
                className="mt-4 block w-full rounded-xl bg-surface-raised/20 py-2.5 text-center text-sm font-semibold backdrop-blur transition-colors hover:bg-surface-raised/30 focus-visible:ring-2 focus-visible:ring-now focus-visible:outline-none"
              >
                Start focus
              </Link>
            </div>
          )}

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
        className="fixed bottom-24 right-5 z-40 grid size-14 place-items-center rounded-2xl bg-iris text-ink-inverse shadow-float transition-transform hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none md:bottom-8 md:right-8"
      >
        <Plus size={26} strokeWidth={2.5} />
      </Link>
    </AppShell>
  );
}
