"use client";

/**
 * Memory Trail — watch a path glow across nine tiles, then walk it back.
 * Each clean run adds one step. Longest trail is the personal best.
 */
import { useEffect, useRef, useState } from "react";
import {
  buildTrail,
  extendTrail,
  readBest,
  recordResult,
  TRAIL_TILES,
} from "@/lib/games";
import { celebrate } from "../Celebration";
import { GameEnd, GameShell } from "./GameShell";

type Stage = "intro" | "watch" | "repeat" | "done";

const FLASH_MS = 420;
const GAP_MS = 180;

export function MemoryTrail({ onExit }: { onExit: () => void }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [trail, setTrail] = useState<number[]>([]);
  const [lit, setLit] = useState<number | null>(null);
  const [tapped, setTapped] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [completedLen, setCompletedLen] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setBest(readBest("memory-trail"));
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      for (const t of timersRef.current) window.clearTimeout(t);
    };
  }, []);

  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };

  const playback = (seq: number[]) => {
    setStage("watch");
    setProgress(0);
    setLit(null);
    seq.forEach((tile, i) => {
      later(() => setLit(tile), 500 + i * (FLASH_MS + GAP_MS));
      later(() => setLit(null), 500 + i * (FLASH_MS + GAP_MS) + FLASH_MS);
    });
    later(() => setStage("repeat"), 500 + seq.length * (FLASH_MS + GAP_MS));
  };

  const start = () => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
    setCompletedLen(0);
    setIsNewBest(false);
    setBest(readBest("memory-trail"));
    const seq = buildTrail();
    setTrail(seq);
    playback(seq);
  };

  const finish = (finalLen: number) => {
    if (finalLen > 0) {
      const newBest = recordResult("memory-trail", finalLen, "high");
      setIsNewBest(newBest);
      if (newBest) celebrate(window.innerWidth / 2, window.innerHeight / 2 - 80);
    }
    setStage("done");
  };

  const tapTile = (idx: number) => {
    if (stage !== "repeat") return;
    setTapped(idx);
    later(() => setTapped(null), 220);
    if (idx !== trail[progress]) {
      finish(completedLen);
      return;
    }
    const nextProgress = progress + 1;
    if (nextProgress < trail.length) {
      setProgress(nextProgress);
      return;
    }
    // Clean run — extend the trail and play it again.
    const len = trail.length;
    setCompletedLen(len);
    const grown = extendTrail(trail);
    setTrail(grown);
    later(() => playback(grown), 650);
    setStage("watch");
    setLit(null);
  };

  return (
    <GameShell
      title="Memory Trail"
      emoji="🐾"
      howTo="Watch the path glow, then walk it back. It grows every round."
      best={best != null ? `trail of ${best}` : null}
      onExit={onExit}
    >
      {stage === "intro" && (
        <div className="rise-in flex flex-col items-center text-center">
          <p className="max-w-xs text-[14.5px] text-ink-soft">
            Nine tiles, one glowing path. It starts three steps long and grows
            each time you get it right. How far can the trail go?
          </p>
          <button
            type="button"
            onClick={start}
            className="mt-7 rounded-2xl bg-iris px-8 py-3.5 text-[15px] font-semibold text-ink-inverse shadow-float transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
          >
            Show me the trail
          </button>
        </div>
      )}

      {(stage === "watch" || stage === "repeat") && (
        <div className="rise-in flex flex-col items-center">
          <p
            className={`mb-4 rounded-xl px-3 py-1.5 text-[13px] font-bold ${
              stage === "watch"
                ? "bg-surface-sunken text-ink-soft"
                : "bg-iris-ghost text-iris"
            }`}
            aria-live="polite"
          >
            {stage === "watch"
              ? `watch — ${trail.length} steps`
              : `your turn — ${progress} of ${trail.length}`}
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {Array.from({ length: TRAIL_TILES }, (_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => tapTile(idx)}
                disabled={stage !== "repeat"}
                aria-label={`Tile ${idx + 1}`}
                className={`size-20 rounded-2xl border transition-all sm:size-24 ${
                  lit === idx
                    ? "scale-105 border-iris-deep bg-iris shadow-float"
                    : tapped === idx
                      ? "scale-95 border-iris bg-iris-soft"
                      : "border-border bg-surface shadow-card"
                } ${stage === "repeat" ? "hover:-translate-y-0.5 active:scale-95" : ""}`}
              />
            ))}
          </div>
        </div>
      )}

      {stage === "done" && (
        <GameEnd
          headline={
            completedLen > 0
              ? `Trail of ${completedLen}`
              : "The trail got away"
          }
          detail={
            completedLen >= 7
              ? "That's a serious stretch of working memory. The tiles are impressed."
              : completedLen > 0
                ? "Every step you held was working memory lifting real weight."
                : "Three glowing tiles move fast — one more watch and you'll have them."
          }
          isNewBest={isNewBest}
          onAgain={start}
          onExit={onExit}
        />
      )}
    </GameShell>
  );
}
