"use client";

/**
 * Steady Breath — box breathing (4-4-4-4), four cycles ≈ one minute. The
 * calm corner of the arcade: an expanding/contracting square, phase words,
 * and zero score pressure (it counts cycles, never grades). Reduced motion
 * gets a static square with phase text only.
 */
import { useEffect, useState } from "react";
import { recordResult } from "@/lib/games";
import { GameEnd, GameShell } from "./GameShell";

const PHASES = [
  { label: "Breathe in", sec: 4 },
  { label: "Hold", sec: 4 },
  { label: "Breathe out", sec: 4 },
  { label: "Rest", sec: 4 },
] as const;

export function SteadyBreath({ onExit }: { onExit: () => void }) {
  const [running, setRunning] = useState(false);
  const [cyclesTarget, setCyclesTarget] = useState(4);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [secLeft, setSecLeft] = useState(4);
  const [finished, setFinished] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setReduced(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        document.documentElement.classList.contains("reduced-stimulation"),
    );
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setSecLeft((s) => {
        if (s > 1) return s - 1;
        // Phase over → advance phase/cycle.
        setPhaseIdx((p) => {
          const nextP = (p + 1) % PHASES.length;
          if (nextP === 0) {
            setCycle((c) => {
              const nextC = c + 1;
              if (nextC >= cyclesTarget) {
                setRunning(false);
                setFinished(true);
                recordResult("steady-breath", cyclesTarget, "count");
              }
              return nextC;
            });
          }
          return nextP;
        });
        return PHASES[(phaseIdx + 1) % PHASES.length]!.sec;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running, phaseIdx, cyclesTarget]);

  const start = (cycles: number) => {
    setCyclesTarget(cycles);
    setCycle(0);
    setPhaseIdx(0);
    setSecLeft(PHASES[0].sec);
    setFinished(false);
    setRunning(true);
  };

  const phase = PHASES[phaseIdx]!;
  const grow = phase.label === "Breathe in" || phase.label === "Hold";

  return (
    <GameShell
      title="Steady Breath"
      emoji="🫧"
      howTo="Box breathing: in 4 · hold 4 · out 4 · rest 4."
      best={null}
      onExit={onExit}
    >
      {!running && !finished && (
        <div className="rise-in flex flex-col items-center text-center">
          <p className="max-w-xs text-[14.5px] text-ink-soft">
            One minute of square breathing settles a spinning head. No score
            here — breathing isn&apos;t a competition.
          </p>
          <div className="mt-7 flex gap-2.5">
            <button
              type="button"
              onClick={() => start(4)}
              className="rounded-2xl bg-iris px-6 py-3 text-[14px] font-semibold text-ink-inverse shadow-card transition-all hover:bg-iris-deep active:scale-[0.98]"
            >
              1 minute
            </button>
            <button
              type="button"
              onClick={() => start(8)}
              className="rounded-2xl border border-border bg-surface px-6 py-3 text-[14px] font-semibold text-ink-soft shadow-card hover:text-ink"
            >
              2 minutes
            </button>
          </div>
        </div>
      )}

      {running && (
        <div className="flex flex-col items-center text-center">
          <div className="grid size-64 place-items-center">
            <div
              className="grid place-items-center rounded-[2rem] border-4 border-iris bg-iris-soft"
              style={{
                width: reduced ? 200 : grow ? 230 : 150,
                height: reduced ? 200 : grow ? 230 : 150,
                transition: reduced
                  ? "none"
                  : "width 3.6s ease-in-out, height 3.6s ease-in-out",
              }}
            >
              <div>
                <p className="font-display text-xl font-bold text-iris">
                  {phase.label}
                </p>
                <p className="tnum mt-1 text-3xl font-bold text-ink">{secLeft}</p>
              </div>
            </div>
          </div>
          <p className="tnum mt-5 text-[13px] font-semibold text-ink-soft">
            cycle {Math.min(cycle + 1, cyclesTarget)} of {cyclesTarget}
          </p>
          <button
            type="button"
            onClick={onExit}
            className="mt-4 rounded-xl px-4 py-2 text-[13px] font-semibold text-ink-faint hover:bg-surface-sunken"
          >
            I&apos;m good, stop here
          </button>
        </div>
      )}

      {finished && (
        <GameEnd
          headline="Steadier."
          detail="That was a real minute of rest — the kind that actually counts. Back to it whenever you're ready."
          isNewBest={false}
          onAgain={() => start(cyclesTarget)}
          onExit={onExit}
        />
      )}
    </GameShell>
  );
}
