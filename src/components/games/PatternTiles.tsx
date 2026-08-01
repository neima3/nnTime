"use client";

/**
 * Pattern Tiles — a handful of tiles light up at once, then hide. Tap the
 * ones that were lit. Each clean recall adds a tile; the largest pattern
 * held is the personal best. Spatial memory, all at once — Memory Trail's
 * simultaneous sibling.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  PATTERN_GRID,
  PATTERN_MAX,
  PATTERN_START,
  patternShowMs,
  pickPatternTiles,
  readBest,
  recordResult,
} from "@/lib/games";
import { celebrate } from "../Celebration";
import { GameEnd, GameShell } from "./GameShell";

type Stage = "intro" | "showing" | "recall" | "done";

export function PatternTiles({ onExit }: { onExit: () => void }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [lit, setLit] = useState<number[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [missed, setMissed] = useState<number | null>(null);
  const [completedSize, setCompletedSize] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setBest(readBest("pattern-tiles"));
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const show = useCallback((size: number) => {
    const tiles = pickPatternTiles(size);
    setLit(tiles);
    setPicked([]);
    setMissed(null);
    setStage("showing");
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(
      () => setStage("recall"),
      patternShowMs(size),
    );
  }, []);

  const start = useCallback(() => {
    setCompletedSize(0);
    setIsNewBest(false);
    setBest(readBest("pattern-tiles"));
    show(PATTERN_START);
  }, [show]);

  const finish = useCallback(
    (finalSize: number) => {
      if (finalSize > 0) {
        const newBest = recordResult("pattern-tiles", finalSize, "high");
        setIsNewBest(newBest);
        if (newBest)
          celebrate(window.innerWidth / 2, window.innerHeight / 2 - 80);
      }
      setStage("done");
    },
    [],
  );

  const tapCell = useCallback(
    (idx: number) => {
      if (stage !== "recall" || picked.includes(idx) || missed != null) return;
      if (!lit.includes(idx)) {
        // A miss ends the climb — kindly, after showing what was right.
        setMissed(idx);
        timerRef.current = window.setTimeout(
          () => finish(completedSize),
          900,
        );
        return;
      }
      const nextPicked = [...picked, idx];
      setPicked(nextPicked);
      if (nextPicked.length === lit.length) {
        const size = lit.length;
        setCompletedSize(size);
        if (size >= PATTERN_MAX) {
          finish(size);
          return;
        }
        timerRef.current = window.setTimeout(() => show(size + 1), 700);
      }
    },
    [stage, picked, missed, lit, completedSize, finish, show],
  );

  const revealMistake = missed != null;

  return (
    <GameShell
      title="Pattern Tiles"
      emoji="🧩"
      howTo="A few tiles flash together. Tap the ones that were lit."
      best={best != null ? `pattern of ${best}` : null}
      onExit={onExit}
    >
      {stage === "intro" && (
        <div className="rise-in flex flex-col items-center text-center">
          <p className="max-w-xs text-[14.5px] text-ink-soft">
            Three tiles light up at once, then hide. Find them all and the
            pattern grows by one. How big a shape can you hold?
          </p>
          <button
            type="button"
            onClick={start}
            className="mt-7 rounded-2xl bg-iris px-8 py-3.5 text-[15px] font-semibold text-ink-inverse shadow-float transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
          >
            Light them up
          </button>
        </div>
      )}

      {(stage === "showing" || stage === "recall") && (
        <div className="rise-in flex flex-col items-center">
          <p
            className={`mb-4 rounded-xl px-3 py-1.5 text-[13px] font-bold ${
              stage === "showing"
                ? "bg-surface-sunken text-ink-soft"
                : "bg-iris-ghost text-iris"
            }`}
            aria-live="polite"
          >
            {stage === "showing"
              ? `memorize — ${lit.length} tiles`
              : `your turn — ${picked.length} of ${lit.length}`}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: PATTERN_GRID }, (_, idx) => {
              const isLitNow =
                (stage === "showing" && lit.includes(idx)) ||
                (revealMistake && lit.includes(idx));
              const isPicked = picked.includes(idx);
              const isMiss = missed === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => tapCell(idx)}
                  disabled={stage !== "recall" || revealMistake}
                  aria-label={`Tile ${idx + 1}${isPicked ? ", found" : ""}`}
                  className={`size-16 rounded-2xl border transition-all sm:size-[4.5rem] ${
                    isMiss
                      ? "border-danger bg-danger-soft"
                      : isPicked
                        ? "border-success/40 bg-success-soft"
                        : isLitNow
                          ? "border-iris-deep bg-iris shadow-float"
                          : "border-border bg-surface shadow-card"
                  } ${stage === "recall" && !revealMistake ? "hover:-translate-y-0.5 active:scale-95" : ""}`}
                />
              );
            })}
          </div>
        </div>
      )}

      {stage === "done" && (
        <GameEnd
          headline={
            completedSize > 0
              ? `Pattern of ${completedSize}`
              : "The tiles kept their secret"
          }
          detail={
            completedSize >= PATTERN_MAX
              ? "Nine at once is the whole board's worth of holding. Remarkable."
              : completedSize >= 6
                ? "Holding six-plus shapes at once is serious spatial memory."
                : completedSize > 0
                  ? "Every tile you held was a little map your brain drew and kept."
                  : "Three tiles vanish fast. One more look and they're yours."
          }
          isNewBest={isNewBest}
          onAgain={start}
          onExit={onExit}
        />
      )}
    </GameShell>
  );
}
