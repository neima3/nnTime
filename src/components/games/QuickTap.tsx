"use client";

/**
 * Quick Tap — reaction rounds. Wait for the tile to turn iris, tap (or hit
 * space) as fast as you can. Early taps are caught kindly. 5 rounds, average
 * ms, personal best.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  QUICK_TAP_ROUNDS,
  quickTapAverage,
  quickTapDelayMs,
  readBest,
  recordResult,
} from "@/lib/games";
import { celebrate } from "../Celebration";
import { GameEnd, GameShell } from "./GameShell";

type Stage = "intro" | "waiting" | "go" | "early" | "between" | "done";

export function QuickTap({ onExit }: { onExit: () => void }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState<(number | null)[]>([]);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const goAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setBest(readBest("quick-tap"));
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const arm = useCallback(() => {
    setStage("waiting");
    timerRef.current = window.setTimeout(() => {
      goAtRef.current = performance.now();
      setStage("go");
    }, quickTapDelayMs(Math.random()));
  }, []);

  const finishRun = useCallback(
    (all: (number | null)[]) => {
      const avg = quickTapAverage(all);
      if (avg != null) {
        const newBest = recordResult("quick-tap", avg, "low");
        setIsNewBest(newBest);
        if (newBest) celebrate(window.innerWidth / 2, window.innerHeight / 2 - 80);
      }
      setStage("done");
    },
    [],
  );

  const tap = useCallback(() => {
    if (stage === "waiting") {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setTimes((t) => [...t, null]);
      setStage("early");
      return;
    }
    if (stage === "go") {
      const ms = Math.round(performance.now() - goAtRef.current);
      setLastMs(ms);
      const all = [...times, ms];
      setTimes(all);
      if (all.length >= QUICK_TAP_ROUNDS) finishRun(all);
      else setStage("between");
    }
  }, [stage, times, finishRun]);

  const nextRound = useCallback(() => {
    setRound((r) => r + 1);
    if (times.length >= QUICK_TAP_ROUNDS) return;
    arm();
  }, [arm, times.length]);

  // Space bar plays too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        if (stage === "waiting" || stage === "go") tap();
        else if (stage === "between" || stage === "early") nextRound();
        else if (stage === "intro") arm();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, tap, nextRound, arm]);

  const restart = () => {
    setTimes([]);
    setRound(0);
    setLastMs(null);
    setIsNewBest(false);
    setBest(readBest("quick-tap"));
    setStage("intro");
  };

  const avg = quickTapAverage(times);

  return (
    <GameShell
      title="Quick Tap"
      emoji="⚡"
      howTo="Wait for purple. Tap (or space) the instant it flips."
      best={best != null ? `${best} ms` : null}
      onExit={onExit}
    >
      {stage === "intro" && (
        <div className="rise-in flex flex-col items-center text-center">
          <p className="max-w-xs text-[14.5px] text-ink-soft">
            The tile turns purple after a sneaky random wait. {QUICK_TAP_ROUNDS}{" "}
            rounds, average speed wins.
          </p>
          <button
            type="button"
            onClick={arm}
            className="mt-7 rounded-2xl bg-iris px-8 py-3.5 text-[15px] font-semibold text-ink-inverse shadow-float transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
          >
            Round {round + 1} — ready
          </button>
        </div>
      )}

      {(stage === "waiting" || stage === "go") && (
        <button
          type="button"
          onClick={tap}
          aria-label={stage === "go" ? "Tap now!" : "Wait for it…"}
          className={`rise-in size-64 rounded-[2.5rem] border-4 shadow-float transition-colors focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none ${
            stage === "go"
              ? "border-iris-deep bg-iris"
              : "border-border bg-surface-sunken"
          }`}
        >
          <span
            className={`font-display text-xl font-bold ${
              stage === "go" ? "text-ink-inverse" : "text-ink-faint"
            }`}
          >
            {stage === "go" ? "TAP!" : "wait for it…"}
          </span>
        </button>
      )}

      {stage === "early" && (
        <div className="rise-in flex flex-col items-center text-center">
          <p className="font-display text-2xl font-bold">Jumped the gun 😅</p>
          <p className="mt-2 text-[14px] text-ink-soft">
            Happens to the best brains. That round doesn&apos;t count against you.
          </p>
          <button
            type="button"
            onClick={nextRound}
            className="mt-6 rounded-2xl bg-iris px-6 py-3 text-[14px] font-semibold text-ink-inverse shadow-card hover:bg-iris-deep"
          >
            Go again
          </button>
        </div>
      )}

      {stage === "between" && (
        <div className="rise-in flex flex-col items-center text-center">
          <p className="tnum font-display text-5xl font-bold tracking-tight">
            {lastMs} ms
          </p>
          <p className="mt-2 text-[14px] font-medium text-ink-soft">
            Round {times.length} of {QUICK_TAP_ROUNDS}
          </p>
          <button
            type="button"
            onClick={nextRound}
            className="mt-6 rounded-2xl bg-iris px-6 py-3 text-[14px] font-semibold text-ink-inverse shadow-card transition-all hover:bg-iris-deep active:scale-[0.98]"
          >
            Next round
          </button>
        </div>
      )}

      {stage === "done" && (
        <GameEnd
          headline={avg != null ? `Average: ${avg} ms` : "All jumps, no taps 😄"}
          detail={
            avg != null
              ? "Fun fact: reaction speed wobbles with sleep, food, and interest. It's a snapshot, not a verdict."
              : "Five early taps is honestly impressive commitment. One more go?"
          }
          isNewBest={isNewBest}
          onAgain={restart}
          onExit={onExit}
        />
      )}
    </GameShell>
  );
}
