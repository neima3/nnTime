import { ArrowRight, Bell, Check } from "lucide-react";

/* Design reference: onboarding (Phase 6A). Four full-screen steps rendered
   here as a vertical reference sheet. Each step is one calm decision;
   every step is skippable; the quiz sets real defaults. */

function StepFrame({
  step,
  children,
}: {
  step: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-md">
      <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        Step {step} of 4
      </p>
      <div className="rounded-[2rem] border border-border bg-surface p-8 shadow-float">
        {/* progress dots */}
        <div className="mb-7 flex justify-center gap-2" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === step ? "w-6 bg-iris" : "w-2 bg-border-strong"
              }`}
            />
          ))}
        </div>
        {children}
      </div>
    </section>
  );
}

const quizOptions = [
  { emoji: "🌊", label: "Plans slip away from me", picked: true },
  { emoji: "🚪", label: "Starting is the hardest part", picked: true },
  { emoji: "⏳", label: "I lose track of time completely", picked: false },
  { emoji: "🌪️", label: "Too many thoughts, no order", picked: true },
];

const templatePick = [
  { emoji: "🌤️", title: "Gentle morning", meta: "3 steps · 40 min", cat: "bg-cat-butter text-cat-butter-ink", picked: true },
  { emoji: "🚀", title: "Launch into work", meta: "3 steps · 1 h", cat: "bg-cat-lilac text-cat-lilac-ink", picked: false },
  { emoji: "🌙", title: "Soft landing", meta: "3 steps · 45 min", cat: "bg-cat-sky text-cat-sky-ink", picked: false },
];

export default function OnboardingPage() {
  return (
    <div className="min-h-dvh space-y-12 bg-canvas px-4 py-12">
      <header className="text-center">
        <h1 className="font-display text-2xl font-bold">Onboarding — design reference</h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          Four full-screen steps · every step skippable (top-right) · quiz answers set real defaults
        </p>
      </header>

      {/* Step 1 — welcome */}
      <StepFrame step={1}>
        <div className="text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-iris text-3xl text-ink-inverse shadow-float">
            ◔
          </span>
          <h2 className="mt-6 font-display text-3xl font-bold leading-tight">
            Time you can see.
          </h2>
          <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-ink-soft">
            Kairo turns your day into shapes and colors your brain can actually
            hold onto. No shame, no streak-guilt, no 47 features on day one.
          </p>
          <button className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-iris py-3.5 text-[15px] font-semibold text-ink-inverse shadow-card">
            Let&apos;s set you up
            <ArrowRight size={17} />
          </button>
          <button className="mt-2.5 w-full py-2 text-[13px] font-semibold text-ink-faint">
            I&apos;ll explore on my own
          </button>
        </div>
      </StepFrame>

      {/* Step 2 — quiz */}
      <StepFrame step={2}>
        <h2 className="font-display text-2xl font-bold leading-tight">
          What does planning usually feel like?
        </h2>
        <p className="mt-1.5 text-[14px] text-ink-soft">
          Pick any that ring true — this tunes your defaults, nothing else.
        </p>
        <div className="mt-5 space-y-2">
          {quizOptions.map((o) => (
            <button
              key={o.label}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all ${
                o.picked
                  ? "border-iris bg-iris-ghost"
                  : "border-border bg-surface hover:border-border-strong"
              }`}
            >
              <span className="text-xl" aria-hidden>
                {o.emoji}
              </span>
              <span className="flex-1 text-[14.5px] font-semibold">{o.label}</span>
              <span
                className={`grid size-6 place-items-center rounded-full ${
                  o.picked
                    ? "bg-iris text-ink-inverse"
                    : "border-2 border-border-strong"
                }`}
              >
                {o.picked && <Check size={13} strokeWidth={3} />}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 rounded-xl bg-surface-sunken px-3 py-2 text-[12px] leading-snug text-ink-soft">
          e.g. &ldquo;Starting is hardest&rdquo; → AI break-it-down is surfaced
          on every task; &ldquo;lose track of time&rdquo; → wrap-up nudges
          default ON.
        </p>
        <button className="mt-5 w-full rounded-2xl bg-iris py-3.5 text-[15px] font-semibold text-ink-inverse shadow-card">
          Continue
        </button>
      </StepFrame>

      {/* Step 3 — first routine */}
      <StepFrame step={3}>
        <h2 className="font-display text-2xl font-bold leading-tight">
          Start with one routine
        </h2>
        <p className="mt-1.5 text-[14px] text-ink-soft">
          Something small that happens most days. You can change everything later.
        </p>
        <div className="mt-5 space-y-2">
          {templatePick.map((t) => (
            <button
              key={t.title}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all ${
                t.picked
                  ? "border-iris bg-iris-ghost"
                  : "border-border bg-surface hover:border-border-strong"
              }`}
            >
              <span className={`grid size-11 place-items-center rounded-2xl text-xl ${t.cat}`}>
                {t.emoji}
              </span>
              <span className="flex-1">
                <span className="block text-[14.5px] font-semibold">{t.title}</span>
                <span className="tnum block text-[12px] font-medium text-ink-soft">
                  {t.meta}
                </span>
              </span>
              {t.picked && (
                <span className="grid size-6 place-items-center rounded-full bg-iris text-ink-inverse">
                  <Check size={13} strokeWidth={3} />
                </span>
              )}
            </button>
          ))}
        </div>
        <button className="mt-5 w-full rounded-2xl bg-iris py-3.5 text-[15px] font-semibold text-ink-inverse shadow-card">
          Add to my mornings
        </button>
        <button className="mt-2.5 w-full py-2 text-[13px] font-semibold text-ink-faint">
          Skip — start from a blank day
        </button>
      </StepFrame>

      {/* Step 4 — notifications */}
      <StepFrame step={4}>
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-iris-soft text-iris">
          <Bell size={26} />
        </span>
        <h2 className="mt-5 text-center font-display text-2xl font-bold leading-tight">
          Gentle nudges, only if you want them
        </h2>
        <p className="mx-auto mt-1.5 max-w-xs text-center text-[14px] leading-relaxed text-ink-soft">
          A soft chime when something starts, a heads-up before it ends. Never
          a guilt trip. Change any of it in Settings.
        </p>
        <div className="mt-5 space-y-2 text-[14px] font-semibold">
          {["When an activity starts", "5 minutes before it ends"].map((l) => (
            <div
              key={l}
              className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3"
            >
              {l}
              <span className="relative inline-flex h-7 w-12 rounded-full bg-iris">
                <span className="absolute top-0.5 size-6 translate-x-[22px] rounded-full bg-surface-raised shadow-card" />
              </span>
            </div>
          ))}
        </div>
        <button className="mt-5 w-full rounded-2xl bg-iris py-3.5 text-[15px] font-semibold text-ink-inverse shadow-card">
          Turn on notifications
        </button>
        <button className="mt-2.5 w-full py-2 text-[13px] font-semibold text-ink-faint">
          Maybe later — take me to Today
        </button>
        <p className="mt-3 text-center text-[11.5px] text-ink-soft">
          The browser permission prompt fires only after this button (user
          gesture — required for iOS PWA push).
        </p>
      </StepFrame>
    </div>
  );
}
