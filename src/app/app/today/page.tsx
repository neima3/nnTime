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
  activities,
  catClasses,
  DAY,
  fmt,
  fmtDuration,
  inbox,
  NOW_MIN,
  type Activity,
} from "@/lib/mock";

const DAY_START = 7 * 60;
const DAY_END = 23 * 60;
const PX_PER_MIN = 1.7;

const top = (min: number) => (min - DAY_START) * PX_PER_MIN;

function ActivityCard({ a }: { a: Activity }) {
  const cat = catClasses[a.category];
  const past = a.start + a.duration <= NOW_MIN;
  const current = a.start <= NOW_MIN && NOW_MIN < a.start + a.duration;
  const h = a.duration * PX_PER_MIN;
  const compact = h < 76;
  const checklistDone = a.checklist?.filter((c) => c.done).length ?? 0;

  return (
    <div
      className={`group absolute inset-x-0 flex gap-3 rounded-2xl px-3.5 transition-transform hover:-translate-y-px hover:shadow-card ${cat.fill} ${
        past ? "opacity-55 saturate-50" : ""
      } ${current ? "shadow-float ring-2 ring-now/70" : ""} ${
        compact ? "items-center py-1.5" : "py-3"
      }`}
      style={{ top: top(a.start), height: h }}
    >
      <span
        className={`grid shrink-0 place-items-center rounded-full bg-surface-raised/80 ${
          compact ? "size-8 text-base" : "size-10 text-lg"
        }`}
        aria-hidden
      >
        {a.emoji}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={`truncate font-semibold leading-tight ${cat.ink} ${
            compact ? "text-[14px]" : "text-[15px]"
          } ${a.done ? "line-through decoration-2 opacity-70" : ""}`}
        >
          {a.title}
        </p>
        <p className={`tnum mt-0.5 truncate text-[12px] font-medium ${cat.ink} opacity-70`}>
          {fmt(a.start)} – {fmt(a.start + a.duration)} · {fmtDuration(a.duration)}
        </p>
        {!compact && (a.checklist || a.energy) && (
          <div className="mt-1.5 flex items-center gap-1.5">
            {a.checklist && (
              <span
                className={`inline-flex items-center gap-1 rounded-lg bg-surface-raised/70 px-1.5 py-0.5 text-[11px] font-semibold ${cat.ink}`}
              >
                <ListChecks size={12} />
                {checklistDone}/{a.checklist.length}
              </span>
            )}
            {a.energy && (
              <span
                className={`inline-flex items-center gap-1 rounded-lg bg-surface-raised/70 px-1.5 py-0.5 text-[11px] font-semibold capitalize ${cat.ink}`}
              >
                <Zap size={12} />
                {a.energy}
              </span>
            )}
          </div>
        )}
      </div>

      <button
        aria-label={a.done ? "Mark incomplete" : "Mark complete"}
        className={`grid shrink-0 place-items-center self-center rounded-full border-2 transition-colors ${
          compact ? "size-7" : "size-8"
        } ${
          a.done
            ? "border-transparent bg-success text-ink-inverse"
            : `border-current ${cat.ink} opacity-50 hover:opacity-100`
        }`}
      >
        {a.done && <Check size={16} strokeWidth={3} />}
      </button>
    </div>
  );
}

function Timeline() {
  const hours = [];
  for (let h = DAY_START / 60; h <= DAY_END / 60; h++) hours.push(h);

  return (
    <div className="relative" style={{ height: (DAY_END - DAY_START) * PX_PER_MIN }}>
      {/* hour grid */}
      {hours.map((h) => (
        <div
          key={h}
          className="absolute inset-x-0 flex items-start gap-3"
          style={{ top: top(h * 60) }}
        >
          <span className="tnum w-10 -translate-y-1/2 text-right text-[12px] font-medium text-ink-faint">
            {h}:00
          </span>
          <div className="mt-px h-px flex-1 bg-border" />
        </div>
      ))}

      {/* now line */}
      <div
        className="absolute inset-x-0 z-20 flex items-center gap-2"
        style={{ top: top(NOW_MIN) }}
      >
        <span className="tnum w-10 -translate-y-1/2 rounded-md bg-now text-center text-[11px] font-bold text-white">
          {fmt(NOW_MIN)}
        </span>
        <div className="relative h-0.5 flex-1 rounded bg-now">
          <span className="absolute -left-1 top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-now" />
        </div>
      </div>

      {/* activities */}
      <div className="absolute inset-y-0 left-14 right-1">
        {activities.map((a) => (
          <ActivityCard key={a.id} a={a} />
        ))}
      </div>
    </div>
  );
}

function DayProgress() {
  const done = activities.filter((a) => a.done).length;
  const pct = Math.round((done / activities.length) * 100);
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

export default function TodayPage() {
  return (
    <AppShell active="today">
      <div className="mx-auto flex max-w-5xl gap-8 px-4 py-6 md:px-8">
        <section className="min-w-0 flex-1">
          <header className="mb-6 flex flex-wrap items-center gap-3">
            <div className="mr-auto">
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-iris">
                {DAY.label}
              </p>
              <h1 className="font-display text-3xl font-bold tracking-tight">
                {DAY.date}
              </h1>
            </div>
            <DayProgress />
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

          <Timeline />
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

          <div className="rounded-3xl bg-iris p-5 text-ink-inverse shadow-float">
            <p className="font-display text-lg font-bold leading-snug">
              Up next: Pharmacy shift prep
            </p>
            <p className="tnum mt-1 text-sm opacity-80">13:30 · in 30 min</p>
            <button className="mt-4 w-full rounded-xl bg-surface-raised/20 py-2.5 text-sm font-semibold backdrop-blur transition-colors hover:bg-surface-raised/30">
              Start early
            </button>
          </div>
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
