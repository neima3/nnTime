"use client";

/**
 * Green Light — the classic go / no-go. Green means tap, red means hold
 * back, and holding back is the hard part on purpose. Twenty-four quick
 * signals; correct calls out of 24 is the personal best.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildGoSequence,
  GO_GAP_MS,
  GO_ROUNDS,
  GO_SHOW_MS,
  readBest,
  recordResult,
} from "@/lib/games";
import { celebrate } from "../Celebration";
import { GameEnd, GameShell } from "./GameShell";

type Stage = "intro" | "playing" | "done";

export function GreenLight({ onExit }: { onExit: () => void }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [idx, setIdx] = useState(0);
  const [showing, setShowing] = useState(false);
  const [goNow, setGoNow] = useState(true);
  const [flash, setFlash] = useState<"hit" | "slip" | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const seqRef = useRef<boolean[]>([]);
  const goRef = useRef(true);
  const tappedRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setBest(readBest("green-light"));
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      for (const t of timersRef.current) window.clearTimeout(t);
    };
  }, []);

  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };

  const finish = useCallback((finalScore: number) => {
    const newBest = recordResult("green-light", finalScore, "high");
    setIsNewBest(newBest);
    if (newBest) celebrate(window.innerWidth / 2, window.innerHeight / 2 - 80);
    setStage("done");
  }, []);

  const start = useCallback(() => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
    seqRef.current = buildGoSequence();
    setScore(0);
    setIdx(0);
    setShowing(false);
    setFlash(null);
    setIsNewBest(false);
    setBest(readBest("green-light"));
    setStage("playing");

    const run = (i: number, runningScore: number) => {
      if (i >= seqRef.current.length) {
        finish(runningScore);
        return;
      }
      tappedRef.current = false;
      goRef.current = seqRef.current[i]!;
      setGoNow(goRef.current);
      setIdx(i);
      setShowing(true);
      setFlash(null);
      later(() => {
        setShowing(false);
        later(() => {
          // Window closed — score the stimulus.
          const go = seqRef.current[i]!;
          const tapped = tappedRef.current;
          const correct = go === tapped;
          const nextScore = runningScore + (correct ? 1 : 0);
          setScore(nextScore);
          if (go && !tapped) setFlash("slip");
          run(i + 1, nextScore);
        }, GO_GAP_MS);
      }, GO_SHOW_MS);
    };
    later(() => run(0, 0), 700);
  }, [finish]);

  const tap = useCallback(() => {
    if (stage !== "playing" || !showing || tappedRef.current) return;
    tappedRef.current = true;
    setFlash(goRef.current ? "hit" : "slip");
  }, [stage, showing]);

  // Space bar plays too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        if (stage === "playing") tap();
        else if (stage === "intro") start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, tap, start]);

  return (
    <GameShell
      title="Green Light"
      emoji="🚦"
      howTo="Green means tap. Red means don't. Holding back is the game."
      best={best != null ? `${best}/${GO_ROUNDS}` : null}
      onExit={onExit}
    >
      {stage === "intro" && (
        <div className="rise-in flex flex-col items-center text-center">
          <p className="max-w-xs text-[14.5px] text-ink-soft">
            Signals flash fast: tap (or space) every green light, and let the
            red ones pass. Your tapping finger will have opinions.
          </p>
          <button
            type="button"
            onClick={start}
            className="mt-7 rounded-2xl bg-iris px-8 py-3.5 text-[15px] font-semibold text-ink-inverse shadow-float transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
          >
            Start the signals
          </button>
        </div>
      )}

      {stage === "playing" && (
        <div className="rise-in flex flex-col items-center">
          <p className="tnum mb-5 text-[13px] font-semibold text-ink-soft">
            {Math.min(idx + 1, GO_ROUNDS)} of {GO_ROUNDS}
          </p>
          <button
            type="button"
            onClick={tap}
            aria-label={
              showing
                ? goNow
                  ? "Green light — tap!"
                  : "Red light — hold back"
                : "Waiting for the next signal"
            }
            className={`grid size-64 place-items-center rounded-[2.5rem] border-4 shadow-float transition-colors focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none ${
              flash === "hit"
                ? "border-success/50 bg-success-soft"
                : flash === "slip"
                  ? "border-danger/50 bg-danger-soft"
                  : "border-border bg-surface-sunken"
            }`}
          >
            <span className="text-7xl" aria-hidden>
              {showing ? (goNow ? "🟢" : "🛑") : ""}
            </span>
          </button>
        </div>
      )}

      {stage === "done" && (
        <GameEnd
          headline={`${score} of ${GO_ROUNDS} right calls`}
          detail={
            score >= 21
              ? "Elite impulse control. Your tapping finger takes orders now."
              : score >= 15
                ? "Solid — stopping a tap mid-flight is genuinely harder than starting one."
                : "The red lights are rigged against eager fingers. Another run evens it out."
          }
          isNewBest={isNewBest}
          onAgain={start}
          onExit={onExit}
        />
      )}
    </GameShell>
  );
}
