"use client";

/**
 * Focus Finder — a Schulte grid. Tap 1→25 in order on a shuffled 5×5 board.
 * Fastest clean sweep is the personal best. Wrong taps just flash — time is
 * the only cost, never shame.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildSchulteGrid,
  readBest,
  recordResult,
  SCHULTE_SIZE,
  schulteSeconds,
} from "@/lib/games";
import { celebrate } from "../Celebration";
import { GameEnd, GameShell } from "./GameShell";

type Stage = "intro" | "playing" | "done";

export function FocusFinder({ onExit }: { onExit: () => void }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [grid, setGrid] = useState<number[]>([]);
  const [next, setNext] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [wrongAt, setWrongAt] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [finalSec, setFinalSec] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const startRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const wrongRef = useRef<number | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setBest(readBest("number-hunt"));
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      if (wrongRef.current) window.clearTimeout(wrongRef.current);
    };
  }, []);

  const start = useCallback(() => {
    setGrid(buildSchulteGrid());
    setNext(1);
    setElapsed(0);
    setIsNewBest(false);
    setBest(readBest("number-hunt"));
    startRef.current = performance.now();
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => {
      setElapsed(performance.now() - startRef.current);
    }, 100);
    setStage("playing");
  }, []);

  const tapCell = useCallback(
    (value: number, idx: number) => {
      if (stage !== "playing") return;
      if (value !== next) {
        setWrongAt(idx);
        if (wrongRef.current) window.clearTimeout(wrongRef.current);
        wrongRef.current = window.setTimeout(() => setWrongAt(null), 350);
        return;
      }
      if (value === SCHULTE_SIZE) {
        if (tickRef.current) window.clearInterval(tickRef.current);
        const sec = schulteSeconds(performance.now() - startRef.current);
        setFinalSec(sec);
        const newBest = recordResult("number-hunt", sec, "low");
        setIsNewBest(newBest);
        if (newBest)
          celebrate(window.innerWidth / 2, window.innerHeight / 2 - 80);
        setStage("done");
        return;
      }
      setNext(value + 1);
    },
    [stage, next],
  );

  return (
    <GameShell
      title="Focus Finder"
      emoji="🔍"
      howTo="Tap 1 to 25 in order. Your eyes do the sprinting."
      best={best != null ? `${best}s` : null}
      onExit={onExit}
    >
      {stage === "intro" && (
        <div className="rise-in flex flex-col items-center text-center">
          <p className="max-w-xs text-[14.5px] text-ink-soft">
            Twenty-five numbers hiding in plain sight. Find them in order —
            wrong taps only cost time, never points.
          </p>
          <button
            type="button"
            onClick={start}
            className="mt-7 rounded-2xl bg-iris px-8 py-3.5 text-[15px] font-semibold text-ink-inverse shadow-float transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
          >
            Start the hunt
          </button>
        </div>
      )}

      {stage === "playing" && (
        <div className="rise-in flex flex-col items-center">
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-xl bg-iris-ghost px-3 py-1.5 text-[13px] font-bold text-iris">
              find {next}
            </span>
            <span className="tnum text-[13px] font-semibold text-ink-soft">
              {(elapsed / 1000).toFixed(1)}s
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {grid.map((value, idx) => {
              const found = value < next;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => tapCell(value, idx)}
                  disabled={found}
                  aria-label={found ? `${value}, found` : `${value}`}
                  className={`tnum grid size-14 place-items-center rounded-2xl border font-display text-lg font-bold transition-all sm:size-16 ${
                    found
                      ? "border-success/30 bg-success-soft text-ink-faint"
                      : wrongAt === idx
                        ? "border-danger bg-danger-soft text-ink"
                        : "border-border bg-surface text-ink shadow-card hover:-translate-y-0.5 active:scale-95"
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {stage === "done" && (
        <GameEnd
          headline={`Swept in ${finalSec}s`}
          detail={
            finalSec <= 45
              ? "That's serious visual scanning — the grid never saw you coming."
              : "Every number you hunted down was attention doing a full workout."
          }
          isNewBest={isNewBest}
          onAgain={start}
          onExit={onExit}
        />
      )}
    </GameShell>
  );
}
