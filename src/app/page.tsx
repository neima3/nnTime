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
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            Sign in
          </Link>
          <Link
            href="/app/today"
            className="hidden rounded-2xl px-4 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink sm:inline"
          >
            Preview
          </Link>
          <Link
            href="/onboarding"
            className="flex items-center gap-2 rounded-2xl bg-iris px-4 py-2.5 text-sm font-semibold text-ink-inverse shadow-card transition-colors hover:bg-iris-deep"
          >
            Get started
            <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      <main>
      {/* hero */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-14 md:grid-cols-2 md:py-24">
        <div>
          <p className="inline-flex rounded-full bg-iris-soft px-3 py-1 text-[13px] font-bold text-iris-deep">
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
              href="/onboarding"
              className="flex items-center gap-2 rounded-2xl bg-iris px-6 py-3.5 text-base font-semibold text-ink-inverse shadow-float transition-all hover:scale-[1.02] hover:bg-iris-deep"
            >
              Get started free
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/sign-up"
              className="text-sm font-semibold text-ink-soft transition-colors hover:text-iris"
            >
              Or create an account →
            </Link>
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

      {/* the five ADHD problems Kairo actually attacks */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto w-full max-w-6xl px-5 py-20">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-iris">
            Built for ADHD brains — honestly
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight md:text-4xl">
            Planners fail ADHD in five specific ways. Kairo has an answer for
            each one.
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <article className="rounded-3xl border border-border bg-canvas p-6">
              <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">
                Time blindness
              </p>
              <h3 className="mt-1.5 font-display text-lg font-bold">
                &ldquo;Now&rdquo; follows you everywhere
              </h3>
              <div className="mt-4 rounded-2xl border border-now/30 bg-surface p-3.5 shadow-card">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-now">
                  <span className="size-2 rounded-full bg-now" aria-hidden /> Now
                </p>
                <p className="mt-1 text-[14px] font-semibold">🎨 Deep work</p>
                <p className="tnum text-[12px] font-medium text-ink-soft">23 min left</p>
              </div>
              <p className="mt-4 text-[13.5px] leading-relaxed text-ink-soft">
                A live now-line on the timeline, a countdown card on every
                screen, and the time left in your browser tab. You can&apos;t
                lose the thread of the day.
              </p>
            </article>

            <article className="rounded-3xl border border-border bg-canvas p-6">
              <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">
                Task paralysis
              </p>
              <h3 className="mt-1.5 font-display text-lg font-bold">
                One button decides for you
              </h3>
              <div className="mt-4 rounded-2xl border border-border bg-surface p-3.5 text-center shadow-card">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-iris">
                  Just this — nothing else
                </p>
                <p className="mt-1.5 text-[14px] font-semibold">🦷 Call the dentist</p>
                <span className="mt-2 inline-block rounded-lg bg-iris px-2.5 py-1 text-[11px] font-bold text-ink-inverse">
                  Start 25 min on this
                </span>
              </div>
              <p className="mt-4 text-[13.5px] leading-relaxed text-ink-soft">
                &ldquo;Pick for me&rdquo; chooses exactly one thing — what&apos;s
                on now, what slipped, or one loose end — so starting stops being
                a decision.
              </p>
            </article>

            <article className="rounded-3xl border border-border bg-canvas p-6">
              <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">
                Hyperfocus
              </p>
              <h3 className="mt-1.5 font-display text-lg font-bold">
                A soft landing, not a jolt
              </h3>
              <div className="mt-4 rounded-2xl border border-cat-butter-ink/25 bg-cat-butter p-3.5 shadow-card">
                <p className="text-[13px] font-semibold text-cat-butter-ink">
                  12 min past your target. Good stopping point?
                </p>
                <div className="mt-2 flex gap-1.5">
                  <span className="rounded-lg bg-cat-butter-ink px-2 py-0.5 text-[11px] font-bold text-cat-butter">
                    Wrap up
                  </span>
                  <span className="rounded-lg px-2 py-0.5 text-[11px] font-bold text-cat-butter-ink">
                    +5 more
                  </span>
                </div>
              </div>
              <p className="mt-4 text-[13.5px] leading-relaxed text-ink-soft">
                The focus timer counts overtime up instead of going silent,
                nudges transitions 5 minutes early, and always offers a break.
              </p>
            </article>

            <article className="rounded-3xl border border-border bg-canvas p-6">
              <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">
                Working memory
              </p>
              <h3 className="mt-1.5 font-display text-lg font-bold">
                Out of your head in 3 seconds
              </h3>
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-surface p-2.5 shadow-card">
                <span className="flex-1 rounded-xl bg-surface-sunken px-3 py-2 text-[13px] text-ink-faint">
                  tuesday 3pm dentist…
                </span>
                <span className="rounded-xl bg-iris px-2.5 py-2 text-[11px] font-bold text-ink-inverse">
                  Save
                </span>
              </div>
              <p className="mt-4 text-[13.5px] leading-relaxed text-ink-soft">
                Press <kbd className="rounded bg-surface-sunken px-1 font-mono text-[12px]">C</kbd>{" "}
                anywhere — type or dictate — and it&apos;s captured. AI can read
                &ldquo;tuesday 3pm&rdquo; and offer to schedule it for you.
              </p>
            </article>

            <article className="rounded-3xl border border-border bg-canvas p-6">
              <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">
                Overwhelm
              </p>
              <h3 className="mt-1.5 font-display text-lg font-bold">
                One thing at a time, literally
              </h3>
              <div className="mt-4 rounded-2xl border border-border bg-surface p-4 text-center shadow-card">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-now">
                  This is the only thing
                </p>
                <p className="mt-1.5 text-[15px] font-bold">🧘 Stretch break</p>
                <p className="tnum text-[11.5px] font-medium text-ink-soft">
                  17 min left — no rush
                </p>
              </div>
              <p className="mt-4 text-[13.5px] leading-relaxed text-ink-soft">
                One-thing mode blanks everything but the current activity. A
                day-load meter warns <em>before</em> you overplan, not after.
              </p>
            </article>

            <article className="rounded-3xl border border-border bg-canvas p-6">
              <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">
                Shame spirals
              </p>
              <h3 className="mt-1.5 font-display text-lg font-bold">
                Nothing here ever turns red
              </h3>
              <div className="mt-4 rounded-2xl border border-success/30 bg-success-soft p-3.5 shadow-card">
                <p className="text-[13px] font-bold text-success">
                  3 things didn&apos;t happen. Totally fine.
                </p>
                <p className="text-[12px] font-medium text-ink-soft">
                  Move them, keep them, or let them go.
                </p>
              </div>
              <p className="mt-4 text-[13.5px] leading-relaxed text-ink-soft">
                No overdue red, no broken-streak guilt — a 1-day grace streak
                and an end-of-day review that treats unfinished plans as
                information, not failure.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* signature moments — the parts people come back for */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-4 pt-20">
        <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-iris">
          The parts people fall for
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight md:text-4xl">
          Progress that feels good — without the pressure.
        </h2>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {/* Reward Garden */}
          <article className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-card">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-cat-mint/40 to-transparent"
            />
            <div className="relative">
              <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">
                Reward garden
              </p>
              <h3 className="mt-1.5 font-display text-lg font-bold">
                Growth a missed day can&apos;t undo
              </h3>
              <div className="mt-5 flex items-center gap-3.5">
                <div className="grid size-16 shrink-0 place-items-center rounded-3xl bg-cat-mint/50 text-4xl">
                  <span aria-hidden>🌷</span>
                </div>
                <div>
                  <p className="font-display text-lg font-bold leading-tight">In bloom</p>
                  <p className="text-[12.5px] text-ink-soft">
                    <span className="font-semibold text-ink">28</span> planted · 4 to flourishing
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1 text-lg" aria-hidden>
                <span>🌸</span><span>🌼</span><span>🌻</span><span>🌷</span><span>🪻</span><span>🌺</span>
              </div>
              <p className="mt-4 text-[13.5px] leading-relaxed text-ink-soft">
                Every finished thing and every focus block plants something. It
                only ever grows — no streak to break, no guilt to carry.
              </p>
            </div>
          </article>

          {/* Focus rituals */}
          <article className="rounded-3xl border border-border bg-surface p-6 shadow-card">
            <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">
              Focus rituals
            </p>
            <h3 className="mt-1.5 font-display text-lg font-bold">
              One tap sets the whole frame
            </h3>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {[
                { e: "🧠", l: "Deep work", on: false },
                { e: "🌙", l: "Wind down", on: true },
                { e: "👥", l: "Body double", on: false },
                { e: "🎨", l: "Creative flow", on: false },
              ].map((r) => (
                <span
                  key={r.l}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-semibold ${
                    r.on
                      ? "border-iris bg-iris-soft text-iris-deep"
                      : "border-border text-ink-soft"
                  }`}
                >
                  <span aria-hidden>{r.e}</span>
                  {r.l}
                </span>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-cat-sky-ink/20 bg-cat-sky/40 p-3.5">
              <span className="text-2xl" aria-hidden>🌙</span>
              <div>
                <p className="text-[14px] font-bold">Wind down</p>
                <p className="tnum text-[12.5px] font-medium text-ink-soft">10:00 · gentle</p>
              </div>
            </div>
            <p className="mt-4 text-[13.5px] leading-relaxed text-ink-soft">
              Named sessions — deep work, a quick win, a body-double block, a
              wind-down — set the title, length, and vibe in a single tap.
            </p>
          </article>

          {/* Routines player */}
          <article className="rounded-3xl border border-border bg-surface p-6 shadow-card">
            <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">
              Routines
            </p>
            <h3 className="mt-1.5 font-display text-lg font-bold">
              A ritual that keeps its own time
            </h3>
            <div className="mt-5 flex flex-col items-center rounded-2xl border border-border bg-canvas p-5">
              <div className="flex gap-1.5" aria-hidden>
                <span className="h-1.5 w-5 rounded-full bg-success" />
                <span className="h-1.5 w-5 rounded-full bg-iris" />
                <span className="size-1.5 rounded-full bg-border-strong" />
                <span className="size-1.5 rounded-full bg-border-strong" />
              </div>
              <p className="tnum mt-4 font-mono text-3xl font-bold">02:41</p>
              <p className="text-[13px] font-bold">Tidy one surface</p>
              <p className="text-[11.5px] font-medium text-ink-soft">
                Step 2 of 4 · next · Tea, no screens
              </p>
            </div>
            <p className="mt-4 text-[13.5px] leading-relaxed text-ink-soft">
              Drop a morning or wind-down routine into any day and run it hands
              free — each step timed, time&apos;s-up waits for you, never rushes.
            </p>
          </article>
        </div>
      </section>

      {/* features */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-24 pt-20">
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
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-ink-soft">
          <p className="font-semibold">Kairo — a nnTime project</p>
          <p>Made with care for ADHD brains. No shame mechanics, ever.</p>
        </div>
      </footer>
    </div>
  );
}
