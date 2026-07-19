"use client";

/**
 * Routine Player (10× ADHD wave 2, Phase 2 — externalized sequencing).
 *
 * Full-screen step runner: one step at a time with its own countdown ring,
 * auto-advance through a short "next up" beat, pause / +1 min / skip / exit.
 * Local-only — no server session; the routine's steps come from
 * GET /api/v1/routines/{id}. Honors reduced motion via the global rules.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Pause, Play, Plus, X } from "lucide-react";
import { celebrate } from "./Celebration";

interface Step {
  title: string;
  durationMin: number;
}

function fmtRemain(sec: number) {
  const s = Math.max(0, sec);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function StepRing({
  remainingSec,
  totalSec,
  emoji,
}: {
  remainingSec: number;
  totalSec: number;
  emoji: string;
}) {
  const size = 260;
  const r = 110;
  const c = 2 * Math.PI * r;
  const elapsedPct = totalSec > 0 ? 1 - remainingSec / totalSec : 0;
  return (
    <div className="relative">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--cat-lilac)" strokeWidth="16" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--cat-lilac-ink)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * Math.min(1, Math.max(0, elapsedPct))}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl" aria-hidden>
          {emoji}
        </span>
        <p className="tnum mt-2 font-mono text-4xl font-semibold tracking-tight">
          {fmtRemain(remainingSec)}
        </p>
      </div>
    </div>
  );
}

export function RoutinePlayer({
  routineId,
  title,
  emoji,
  onExit,
}: {
  routineId: string;
  title: string;
  emoji: string;
  onExit: () => void;
}) {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [error, setError] = useState(false);
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [paused, setPaused] = useState(false);
  const [between, setBetween] = useState(false);
  const [done, setDone] = useState<{ elapsedMin: number } | null>(null);
  const [skipped, setSkipped] = useState(0);
  const startedAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/routines/${routineId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        interface WireStep {
          title?: string;
          durationMin?: number | null;
        }
        const s: Step[] = ((data?.steps ?? []) as WireStep[]).map((x) => ({
          title: String(x.title ?? "Step"),
          durationMin: Math.max(1, Number(x.durationMin ?? 5)),
        }));
        if (s.length === 0) {
          setError(true);
          return;
        }
        setSteps(s);
        setRemaining(s[0]!.durationMin * 60);
        startedAtRef.current = Date.now();
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [routineId]);

  const advance = useCallback(
    (didSkip: boolean) => {
      if (!steps) return;
      if (didSkip) setSkipped((n) => n + 1);
      if (idx + 1 >= steps.length) {
        celebrate(window.innerWidth / 2, window.innerHeight / 2 - 60);
        setDone({
          elapsedMin: Math.max(
            1,
            Math.round((Date.now() - startedAtRef.current) / 60000),
          ),
        });
        return;
      }
      setBetween(true);
      setIdx((i) => i + 1);
      setRemaining(steps[idx + 1]!.durationMin * 60);
      window.setTimeout(() => setBetween(false), 2000);
    },
    [steps, idx],
  );

  // Step countdown.
  useEffect(() => {
    if (!steps || paused || between || done) return;
    const t = setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          clearInterval(t);
          // Advance on the next tick so state updates stay consistent.
          setTimeout(() => advance(false), 0);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [steps, paused, between, done, advance]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const doneCount = idx + (done ? 1 : 0) - skipped;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-canvas px-6">
      <button
        type="button"
        aria-label="Exit routine"
        onClick={onExit}
        className="absolute right-5 top-5 grid size-11 place-items-center rounded-2xl border border-border bg-surface text-ink-soft shadow-card hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
      >
        <X size={18} />
      </button>

      {error && (
        <div className="text-center">
          <p className="font-display text-2xl font-bold">Couldn&apos;t load this routine.</p>
          <button
            type="button"
            onClick={onExit}
            className="mt-6 rounded-2xl border border-border bg-surface px-6 py-3 text-[14px] font-semibold text-ink-soft shadow-card"
          >
            Back
          </button>
        </div>
      )}

      {!error && !steps && (
        <div className="size-[260px] animate-pulse rounded-full border-[16px] border-surface-sunken" aria-label="Loading routine" />
      )}

      {steps && done && (
        <div className="rise-in flex max-w-md flex-col items-center text-center">
          <span className="grid size-16 place-items-center rounded-3xl bg-success-soft text-3xl" aria-hidden>
            🎉
          </span>
          <h1 className="mt-5 font-display text-3xl font-bold tracking-tight">
            Routine done.
          </h1>
          <p className="tnum mt-2 text-[15px] text-ink-soft">
            {Math.max(0, doneCount)} of {steps.length} steps · about {done.elapsedMin} min
          </p>
          <button
            type="button"
            onClick={onExit}
            className="mt-8 rounded-2xl bg-iris px-8 py-3 text-[15px] font-semibold text-ink-inverse shadow-card transition-colors hover:bg-iris-deep focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
          >
            Nice — back to routines
          </button>
        </div>
      )}

      {steps && !done && (
        <div className="flex flex-col items-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-ink-faint">
            {title} · step {idx + 1} of {steps.length}
          </p>
          {between ? (
            <div className="rise-in mt-10 flex h-[260px] flex-col items-center justify-center text-center">
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                Next up
              </p>
              <p className="mt-3 font-display text-3xl font-bold">{steps[idx]!.title}</p>
            </div>
          ) : (
            <>
              <h1 className="mt-2 max-w-md text-center font-display text-3xl font-bold tracking-tight">
                {steps[idx]!.title}
              </h1>
              <div className="mt-8">
                <StepRing
                  remainingSec={remaining}
                  totalSec={steps[idx]!.durationMin * 60}
                  emoji={emoji}
                />
              </div>
              <div className="mt-8 flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Add a minute"
                  onClick={() => setRemaining((s) => s + 60)}
                  className="grid size-12 place-items-center rounded-full border border-border bg-surface text-ink-soft shadow-card hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
                >
                  <Plus size={20} />
                </button>
                <button
                  type="button"
                  aria-label={paused ? "Resume" : "Pause"}
                  onClick={() => setPaused((p) => !p)}
                  className="grid size-16 place-items-center rounded-full bg-iris text-ink-inverse shadow-float transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
                >
                  {paused ? <Play size={26} fill="currentColor" /> : <Pause size={26} fill="currentColor" />}
                </button>
                <button
                  type="button"
                  aria-label="Skip this step"
                  onClick={() => advance(true)}
                  className="grid size-12 place-items-center rounded-full border border-border bg-surface text-ink-soft shadow-card hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
              <p className="mt-4 text-[12px] font-medium text-ink-faint">
                {paused ? "Paused — whenever you're ready" : "Auto-advances when the timer ends"}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
