import { Check, Pause, Plus, SkipForward, Volume2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";

/* Focus mode mock: "Pharmacy shift prep", 60 min total, 22:30 remaining (62.5% elapsed) */
const ELAPSED_PCT = 0.625;

function FocusRing() {
  const size = 300;
  const r = 128;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--cat-sky)"
          strokeWidth="18"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--cat-sky-ink)"
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * ELAPSED_PCT}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl" aria-hidden>
          💊
        </span>
        <p className="tnum mt-3 font-mono text-5xl font-semibold tracking-tight">
          22:30
        </p>
        <p className="mt-1 text-sm font-medium text-ink-soft">remaining of 1 h</p>
      </div>
    </div>
  );
}

export default function FocusPage() {
  return (
    <AppShell active="focus">
      <div className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-2xl flex-col items-center px-4 py-10 md:min-h-dvh md:justify-center">
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
          Now focusing
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
          Pharmacy shift prep
        </h1>
        <p className="tnum mt-1 text-sm font-medium text-ink-soft">
          13:30 – 14:30 · sky
        </p>

        <div className="mt-10">
          <FocusRing />
        </div>

        {/* controls */}
        <div className="mt-10 flex items-center gap-4">
          <button
            aria-label="Extend 10 minutes"
            className="grid size-14 place-items-center rounded-full border border-border bg-surface text-ink-soft shadow-card transition-colors hover:text-ink"
          >
            <Plus size={22} />
          </button>
          <button
            aria-label="Pause"
            className="grid size-20 place-items-center rounded-full bg-iris text-ink-inverse shadow-float transition-transform hover:scale-105"
          >
            <Pause size={30} fill="currentColor" />
          </button>
          <button
            aria-label="Skip to next"
            className="grid size-14 place-items-center rounded-full border border-border bg-surface text-ink-soft shadow-card transition-colors hover:text-ink"
          >
            <SkipForward size={22} />
          </button>
        </div>

        {/* checklist for this activity */}
        <div className="mt-10 w-full max-w-md rounded-3xl border border-border bg-surface p-5 shadow-card">
          <h2 className="font-display text-base font-bold">Steps</h2>
          <ul className="mt-3 space-y-1">
            {[
              { label: "Review schedule", done: true },
              { label: "Pack bag", done: false },
            ].map((s) => (
              <li key={s.label} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-sunken">
                <span
                  className={`grid size-6 place-items-center rounded-full border-2 ${
                    s.done
                      ? "border-transparent bg-success text-ink-inverse"
                      : "border-border-strong"
                  }`}
                >
                  {s.done && <Check size={14} strokeWidth={3} />}
                </span>
                <span
                  className={`text-[15px] font-medium ${
                    s.done ? "text-ink-faint line-through" : ""
                  }`}
                >
                  {s.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* ambient + next up */}
        <div className="mt-4 flex w-full max-w-md items-center justify-between gap-3">
          <button className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-ink-soft shadow-card transition-colors hover:text-ink">
            <Volume2 size={17} />
            Rain sounds
          </button>
          <p className="text-[13px] font-medium text-ink-soft">
            Next: <span className="text-ink">📞 Call Sahar · 15:00</span>
          </p>
        </div>
      </div>
    </AppShell>
  );
}
