import { ArrowRight, Check, ListChecks, SkipForward } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { catClasses, reviewItems } from "@/lib/mock";

/* Design reference: the guided end-of-day "Review Today" flow (Phase 2D).
   One card per unfinished item, three gentle verbs, then a soft summary.
   Two states shown: mid-flow and completion. */

export default function ReviewPage() {
  const current = reviewItems[0];
  const cat = catClasses[current.category];

  return (
    <AppShell active="today">
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-10">
        {/* ---- State 1: mid-flow ---- */}
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
          Review today
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
          3 things didn&apos;t happen
        </h1>
        <p className="mt-1.5 text-[14px] text-ink-soft">
          Totally fine. Let&apos;s decide what they become.
        </p>

        {/* progress dots */}
        <div className="mt-5 flex items-center gap-2" aria-label="Item 1 of 3">
          <span className="h-2 w-6 rounded-full bg-iris" />
          <span className="size-2 rounded-full bg-border-strong" />
          <span className="size-2 rounded-full bg-border-strong" />
        </div>

        {/* current item card */}
        <div className="mt-6 w-full rounded-3xl border border-border bg-surface p-6 shadow-float">
          <div className="flex items-center gap-4">
            <span
              className={`grid size-14 shrink-0 place-items-center rounded-2xl text-2xl ${cat.fill}`}
              aria-hidden
            >
              {current.emoji}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-xl font-bold">
                {current.title}
              </p>
              <p className="tnum mt-0.5 text-[13px] font-medium text-ink-soft">
                {current.time}
              </p>
              {current.checklist && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-lg bg-surface-sunken px-2 py-0.5 text-[12px] font-semibold text-ink-soft">
                  <ListChecks size={12} />
                  {current.checklist}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2">
            <button className="flex flex-col items-center gap-1.5 rounded-2xl bg-success-soft py-3.5 text-success transition-transform hover:scale-[1.03]">
              <Check size={20} strokeWidth={2.5} />
              <span className="text-[13px] font-bold">Did it</span>
            </button>
            <button className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-surface py-3.5 text-ink-soft transition-transform hover:scale-[1.03] hover:text-ink">
              <SkipForward size={20} />
              <span className="text-[13px] font-bold">Let it go</span>
            </button>
            <button className="flex flex-col items-center gap-1.5 rounded-2xl bg-iris-soft py-3.5 text-iris transition-transform hover:scale-[1.03]">
              <ArrowRight size={20} strokeWidth={2.5} />
              <span className="text-[13px] font-bold">Tomorrow</span>
            </button>
          </div>
          <p className="mt-3 text-center text-[12px] text-ink-soft">
            &ldquo;Tomorrow&rdquo; keeps checklist progress · &ldquo;Let it
            go&rdquo; skips without guilt (recorded as a skip, never a fail)
          </p>
        </div>

        {/* ---- State 2: completion ---- */}
        <p className="mt-14 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
          Completion state reference
        </p>
        <div className="mt-3 w-full rounded-3xl border border-border bg-surface p-8 text-center shadow-card">
          <p className="text-4xl" aria-hidden>
            🌙
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold">Day, reviewed.</h2>
          <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed text-ink-soft">
            6 done · 1 moved to tomorrow · 1 let go.
            <br />
            Your 5-day streak is safe. Sleep well.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button className="rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] font-semibold text-ink-soft hover:text-ink">
              See tomorrow
            </button>
            <button className="rounded-xl bg-iris px-5 py-2.5 text-[14px] font-semibold text-ink-inverse shadow-card hover:bg-iris-deep">
              Done
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
