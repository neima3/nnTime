"use client";

/**
 * Odd One Out — one impostor emoji hides among its near-twins. Eight rounds,
 * the grid grows 3×3 → 5×5, and the clock is the only score. Wrong taps
 * flash and cost time, never points.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildOddRound,
  ODD_ROUNDS,
  readBest,
  recordResult,
  schulteSeconds,
  shuffledOddPairs,
  type OddRound,
} from "@/lib/games";
import { celebrate } from "../Celebration";
import { GameEnd, GameShell } from "./GameShell";

type Stage = "intro" | "playing" | "done";

const COLS: Record<number, string> = {
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

export function OddOneOut({ onExit }: { onExit: () => void }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [roundNo, setRoundNo] = useState(0);
  const [round, setRound] = useState<OddRound | null>(null);
  const [wrongAt, setWrongAt] = useState<number | null>(null);
  const [foundAt, setFoundAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [finalSec, setFinalSec] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const pairsRef = useRef(shuffledOddPairs());
  const startRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const flashRef = useRef<number | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setBest(readBest("odd-one-out"));
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      if (flashRef.current) window.clearTimeout(flashRef.current);
    };
  }, []);

  const start = useCallback(() => {
    pairsRef.current = shuffledOddPairs();
    setRoundNo(0);
    setRound(buildOddRound(0, pairsRef.current[0]!));
    setWrongAt(null);
    setFoundAt(null);
    setElapsed(0);
    setIsNewBest(false);
    setBest(readBest("odd-one-out"));
    startRef.current = performance.now();
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => {
      setElapsed(performance.now() - startRef.current);
    }, 100);
    setStage("playing");
  }, []);

  const tapCell = useCallback(
    (idx: number) => {
      if (stage !== "playing" || !round || foundAt != null) return;
      if (idx !== round.oddIndex) {
        setWrongAt(idx);
        if (flashRef.current) window.clearTimeout(flashRef.current);
        flashRef.current = window.setTimeout(() => setWrongAt(null), 320);
        return;
      }
      setFoundAt(idx);
      const nextNo = roundNo + 1;
      if (nextNo >= ODD_ROUNDS) {
        if (tickRef.current) window.clearInterval(tickRef.current);
        const sec = schulteSeconds(performance.now() - startRef.current);
        setFinalSec(sec);
        const newBest = recordResult("odd-one-out", sec, "low");
        setIsNewBest(newBest);
        if (newBest)
          celebrate(window.innerWidth / 2, window.innerHeight / 2 - 80);
        flashRef.current = window.setTimeout(() => setStage("done"), 350);
        return;
      }
      flashRef.current = window.setTimeout(() => {
        setFoundAt(null);
        setWrongAt(null);
        setRoundNo(nextNo);
        setRound(buildOddRound(nextNo, pairsRef.current[nextNo]!));
      }, 350);
    },
    [stage, round, roundNo, foundAt],
  );

  return (
    <GameShell
      title="Odd One Out"
      emoji="🕵️"
      howTo="One of these is not like the others. Spot it fast."
      best={best != null ? `${best}s` : null}
      onExit={onExit}
    >
      {stage === "intro" && (
        <div className="rise-in flex flex-col items-center text-center">
          <p className="max-w-xs text-[14.5px] text-ink-soft">
            Every round hides one near-twin impostor in the crowd. Eight
            rounds, growing grids — only the clock keeps score.
          </p>
          <button
            type="button"
            onClick={start}
            className="mt-7 rounded-2xl bg-iris px-8 py-3.5 text-[15px] font-semibold text-ink-inverse shadow-float transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
          >
            Start spotting
          </button>
        </div>
      )}

      {stage === "playing" && round && (
        <div className="rise-in flex flex-col items-center">
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-xl bg-iris-ghost px-3 py-1.5 text-[13px] font-bold text-iris">
              round {roundNo + 1} of {ODD_ROUNDS}
            </span>
            <span className="tnum text-[13px] font-semibold text-ink-soft">
              {(elapsed / 1000).toFixed(1)}s
            </span>
          </div>
          <div className={`grid gap-2 ${COLS[round.size]}`}>
            {Array.from({ length: round.size * round.size }, (_, idx) => (
              <button
                key={`${roundNo}-${idx}`}
                type="button"
                onClick={() => tapCell(idx)}
                aria-label={`Tile ${idx + 1}`}
                className={`grid size-14 place-items-center rounded-2xl border text-2xl transition-all sm:size-16 ${
                  foundAt === idx
                    ? "border-success/40 bg-success-soft"
                    : wrongAt === idx
                      ? "border-danger bg-danger-soft"
                      : "border-border bg-surface shadow-card hover:-translate-y-0.5 active:scale-95"
                }`}
              >
                <span aria-hidden>
                  {idx === round.oddIndex ? round.odd : round.base}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {stage === "done" && (
        <GameEnd
          headline={`All eight in ${finalSec}s`}
          detail={
            finalSec <= 30
              ? "Hawk eyes. The impostors are filing a complaint."
              : "Telling almost-identical things apart is genuinely hard attention work — and you did it eight times."
          }
          isNewBest={isNewBest}
          onAgain={start}
          onExit={onExit}
        />
      )}
    </GameShell>
  );
}
