import { Play, Plus, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { catClasses, fmtDuration, routines } from "@/lib/mock";

export default function RoutinesPage() {
  return (
    <AppShell active="routines">
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        <header className="mb-6 flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Routines
            </h1>
            <p className="mt-1 text-[14px] text-ink-soft">
              Sequences you can drop into any day — one tap to schedule.
            </p>
          </div>
          <button className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-iris shadow-card transition-colors hover:bg-iris-ghost">
            <Sparkles size={16} />
            Browse templates
          </button>
          <button className="flex items-center gap-2 rounded-2xl bg-iris px-4 py-2.5 text-sm font-semibold text-ink-inverse shadow-card transition-colors hover:bg-iris-deep">
            <Plus size={17} strokeWidth={2.5} />
            New routine
          </button>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {routines.map((r) => {
            const cat = catClasses[r.category];
            return (
              <article
                key={r.id}
                className="group flex flex-col rounded-3xl border border-border bg-surface p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-float"
              >
                <div className="flex items-start justify-between">
                  <span
                    className={`grid size-12 place-items-center rounded-2xl text-2xl ${cat.fill}`}
                    aria-hidden
                  >
                    {r.emoji}
                  </span>
                  <button
                    aria-label={`Start ${r.title}`}
                    className="grid size-10 place-items-center rounded-full bg-iris-soft text-iris opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Play size={17} fill="currentColor" />
                  </button>
                </div>
                <h2 className="mt-4 font-display text-lg font-bold leading-tight">
                  {r.title}
                </h2>
                <p className="tnum mt-1 text-[13px] font-medium text-ink-soft">
                  {r.steps} steps · {fmtDuration(r.minutes)}
                </p>
                <p className="mt-3 inline-flex w-fit rounded-lg bg-surface-sunken px-2 py-1 text-[12px] font-semibold text-ink-soft">
                  {r.days}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
