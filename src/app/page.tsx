import Link from "next/link";
import {
  ArrowRight,
  Brain,
  CalendarSync,
  Eye,
  ListChecks,
  Repeat,
  Timer,
} from "lucide-react";
import { catClasses } from "@/lib/mock";

const heroBlocks = [
  { emoji: "🌤️", title: "Morning reset", time: "8:00 – 8:45", category: "butter" as const, done: true },
  { emoji: "🎨", title: "Deep work", time: "9:30 – 11:30", category: "lilac" as const, done: true },
  { emoji: "🍜", title: "Lunch", time: "12:30 – 13:15", category: "peach" as const, now: true },
  { emoji: "💊", title: "Shift prep", time: "13:30 – 14:30", category: "sky" as const },
  { emoji: "🏋️", title: "Gym", time: "17:00 – 18:15", category: "mint" as const },
];

const features = [
  {
    icon: Eye,
    title: "See your day, don't read it",
    body: "Every plan is a shape on a visual timeline — color, icon, and length you can feel at a glance.",
  },
  {
    icon: Timer,
    title: "Focus that holds your hand",
    body: "A calm countdown ring, gentle halfway nudges, and one-tap extensions when you're in the zone.",
  },
  {
    icon: Brain,
    title: "AI that unblocks starting",
    body: "Stuck on a vague task? Kairo breaks it into small, doable steps and slots them into your day.",
  },
  {
    icon: Repeat,
    title: "Routines on autopilot",
    body: "Build sequences once — morning reset, wind-down — and drop them into any day with one tap.",
  },
  {
    icon: ListChecks,
    title: "Anytime, not overdue",
    body: "Tasks without a time never turn red. They wait patiently until you have space for them.",
  },
  {
    icon: CalendarSync,
    title: "Your calendars, one view",
    body: "Google, Apple, and Outlook events flow into your timeline so nothing lives in two places.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      {/* nav */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-iris text-lg text-ink-inverse shadow-card">
            ◔
          </span>
          <span className="font-display text-xl font-bold tracking-tight">Kairo</span>
        </div>
        <Link
          href="/app/today"
          className="flex items-center gap-2 rounded-2xl bg-iris px-4 py-2.5 text-sm font-semibold text-ink-inverse shadow-card transition-colors hover:bg-iris-deep"
        >
          Open the app
          <ArrowRight size={16} />
        </Link>
      </header>

      {/* hero */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-14 md:grid-cols-2 md:py-24">
        <div>
          <p className="inline-flex rounded-full bg-iris-soft px-3 py-1 text-[13px] font-bold text-iris">
            Built for brains that plan differently
          </p>
          <h1 className="mt-5 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Time you can{" "}
            <span className="relative inline-block text-iris">
              see
              <svg
                className="absolute -bottom-2 left-0 w-full"
                viewBox="0 0 120 12"
                fill="none"
                aria-hidden
              >
                <path
                  d="M3 9c30-6 84-6 114-3"
                  stroke="var(--now)"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            .
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft">
            Kairo turns your day into a visual timeline — gentle, colorful, and
            impossible to lose track of. A planner designed with ADHD and
            autistic brains in mind, made for everyone.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/app/today"
              className="flex items-center gap-2 rounded-2xl bg-iris px-6 py-3.5 text-base font-semibold text-ink-inverse shadow-float transition-all hover:scale-[1.02] hover:bg-iris-deep"
            >
              Preview the design
              <ArrowRight size={18} />
            </Link>
            <p className="text-sm font-medium text-ink-faint">
              Web · iOS · design preview
            </p>
          </div>
        </div>

        {/* hero mock: mini day timeline */}
        <div className="relative mx-auto w-full max-w-sm">
          <div className="absolute -inset-6 rounded-[3rem] bg-iris-soft/60 blur-2xl" aria-hidden />
          <div className="relative rounded-[2rem] border border-border bg-surface p-5 shadow-float">
            <div className="flex items-baseline justify-between px-1">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-iris">
                  Saturday
                </p>
                <p className="font-display text-xl font-bold">July 12</p>
              </div>
              <span className="tnum rounded-lg bg-surface-sunken px-2 py-1 text-[12px] font-bold text-ink-soft">
                4/10 done
              </span>
            </div>
            <div className="mt-4 space-y-2.5">
              {heroBlocks.map((b) => {
                const cat = catClasses[b.category];
                return (
                  <div key={b.title} className="relative">
                    {b.now && (
                      <div className="absolute -left-3 -top-1.5 right-0 z-10 flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-now" />
                        <span className="h-0.5 flex-1 rounded bg-now" />
                      </div>
                    )}
                    <div
                      className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 ${cat.fill} ${
                        b.done ? "opacity-55 saturate-50" : ""
                      } ${b.now ? "ring-2 ring-now/60" : ""}`}
                    >
                      <span className="grid size-9 place-items-center rounded-full bg-surface-raised/80 text-base">
                        {b.emoji}
                      </span>
                      <div className="flex-1">
                        <p
                          className={`text-[14px] font-semibold leading-tight ${cat.ink} ${
                            b.done ? "line-through" : ""
                          }`}
                        >
                          {b.title}
                        </p>
                        <p className={`tnum text-[11.5px] font-medium ${cat.ink} opacity-70`}>
                          {b.time}
                        </p>
                      </div>
                      <span
                        className={`grid size-6 place-items-center rounded-full border-2 ${
                          b.done
                            ? "border-transparent bg-success text-[10px] font-black text-ink-inverse"
                            : `border-current opacity-40 ${cat.ink}`
                        }`}
                      >
                        {b.done && "✓"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* features */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-24">
        <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          Everything a day needs.
          <br />
          <span className="text-ink-soft">Nothing that overwhelms.</span>
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="rounded-3xl border border-border bg-surface p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-float"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-iris-soft text-iris">
                <Icon size={21} />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold leading-snug">
                {title}
              </h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">
                {body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-ink-soft">
          <p className="font-semibold">Kairo — a nnTime project</p>
          <p>Design preview · features in development</p>
        </div>
      </footer>
    </div>
  );
}
