"use client";

/**
 * Time Feel — the signature brain break. A time-reproduction task straight
 * out of the ADHD time-perception literature, framed as play: no clock, tap
 * when you think N seconds have passed. Kind feedback, personal best only.
 */
import { useEffect, useRef, useState } from "react";
import {
  TIME_FEEL_ROUNDS,
  readBest,
  recordResult,
  timeFeelFeeling,
  timeFeelScore,
} from "@/lib/games";
import { celebrate } from "../Celebration";
import { GameEnd, GameShell } from "./GameShell";

type Stage = "intro" | "counting" | "feedback" | "done";

export function TimeFeel({ onExit }: { onExit: () => void }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<{ targetSec: number; actualSec: number }[]>([]);
  const [best, setBest] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const startedAtRef = useRef(0);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setBest(readBest("time-feel"));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const target = TIME_FEEL_ROUNDS[round] ?? TIME_FEEL_ROUNDS[0];

  const begin = () => {
    startedAtRef.current = performance.now();
    setStage("counting");
  };

  const tap = () => {
    const actualSec = (performance.now() - startedAtRef.current) / 1000;
    const next = [...results, { targetSec: target, actualSec }];
    setResults(next);
    if (next.length >= TIME_FEEL_ROUNDS.length) {
      const score = timeFeelScore(next);
      const newBest = recordResult("time-feel", score, "high");
      setIsNewBest(newBest);
      if (newBest) celebrate(window.innerWidth / 2, window.innerHeight / 2 - 80);
      setStage("done");
    } else {
      setStage("feedback");
    }
  };

  const nextRound = () => {
    setRound((r) => r + 1);
    setStage("intro");
  };

  const restart = () => {
    setResults([]);
    setRound(0);
    setIsNewBest(false);
    setBest(readBest("time-feel"));
    setStage("intro");
  };

  const last = results[results.length - 1];

  return (
    <GameShell
      title="Time Feel"
      emoji="⏳"
      howTo="No clock. Tap when you think the time is up."
      best={best != null ? `${best}` : null}
      onExit={onExit}
    >
      {stage === "intro" && (
        <div className="rise-in flex flex-col items-center text-center">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-ink-faint">
            Round {round + 1} of {TIME_FEEL_ROUNDS.length}
          </p>
          <p className="mt-6 font-display text-5xl font-bold tracking-tight">
            {target} seconds
          </p>
          <p className="mt-3 max-w-xs text-[14.5px] text-ink-soft">
            Press start, feel the time pass, tap when you think {target} seconds
            are up. No counting out loud — that&apos;s cheating yourself.
          </p>
          <button
            type="button"
            onClick={begin}
            className="mt-8 rounded-2xl bg-iris px-8 py-3.5 text-[15px] font-semibold text-ink-inverse shadow-float transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
          >
            Start feeling
          </button>
        </div>
      )}

      {stage === "counting" && (
        <button
          type="button"
          onClick={tap}
          className="rise-in flex size-64 flex-col items-center justify-center rounded-full border-8 border-iris-soft bg-surface text-center shadow-float transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
        >
          <span className="text-5xl" aria-hidden>
            ⏳
          </span>
          <span className="mt-3 px-6 font-display text-lg font-bold leading-snug">
            Tap when {target}s feel over
          </span>
        </button>
      )}

      {stage === "feedback" && last && (
        <div className="rise-in flex flex-col items-center text-center">
          <p className="tnum font-display text-4xl font-bold tracking-tight">
            {last.actualSec.toFixed(1)}s
          </p>
          <p className="mt-2 text-[15px] font-semibold">
            {timeFeelFeeling(last.targetSec, last.actualSec) === "spot-on"
              ? "Spot on. Your inner clock showed up today."
              : timeFeelFeeling(last.targetSec, last.actualSec) === "fast"
                ? `${last.targetSec}s felt shorter to you — a fast-running brain.`
                : `${last.targetSec}s felt longer to you — time was dragging.`}
          </p>
          <button
            type="button"
            onClick={nextRound}
            className="mt-7 rounded-2xl bg-iris px-6 py-3 text-[14px] font-semibold text-ink-inverse shadow-card transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
          >
            Next round
          </button>
        </div>
      )}

      {stage === "done" && (
        <GameEnd
          headline={`Inner clock: ${timeFeelScore(results)}/100`}
          detail="Everyone's clock drifts — ADHD brains often more. That's exactly why your timeline does the feeling for you."
          isNewBest={isNewBest}
          onAgain={restart}
          onExit={onExit}
        />
      )}
    </GameShell>
  );
}
