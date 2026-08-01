"use client";

/**
 * Night Sky — trace a small constellation, star by star, in order. No timer,
 * no score, no failure: a wind-down. The counter only remembers how many
 * skies you've traced, ever.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CONSTELLATIONS,
  pickConstellation,
  readBest,
  recordResult,
} from "@/lib/games";
import { GameShell } from "./GameShell";

type Stage = "intro" | "tracing" | "done";

export function NightSky({ onExit }: { onExit: () => void }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [skyIndex, setSkyIndex] = useState(0);
  const [lit, setLit] = useState(0);
  const [traced, setTraced] = useState<number | null>(null);
  const doneRef = useRef<number | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setTraced(readBest("night-sky"));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const start = useCallback(() => {
    setSkyIndex(pickConstellation());
    setLit(0);
    doneRef.current = null;
    setStage("tracing");
  }, []);

  const sky = CONSTELLATIONS[skyIndex]!;

  const tapStar = useCallback(
    (idx: number) => {
      if (stage !== "tracing" || idx !== lit) return;
      const next = lit + 1;
      setLit(next);
      if (next >= sky.points.length && doneRef.current !== next) {
        doneRef.current = next;
        recordResult("night-sky", 1, "count");
        setTraced((t) => (t ?? 0) + 1);
        window.setTimeout(() => setStage("done"), 700);
      }
    },
    [stage, lit, sky.points.length],
  );

  return (
    <GameShell
      title="Night Sky"
      emoji="🌌"
      howTo="Connect the stars, one at a time. Nothing is timed."
      best={traced != null && traced > 0 ? `${traced} skies traced` : null}
      onExit={onExit}
    >
      {stage === "intro" && (
        <div className="rise-in flex flex-col items-center text-center">
          <p className="max-w-xs text-[14.5px] text-ink-soft">
            A small constellation is waiting. Tap its stars in order and watch
            the lines appear. No clock, no score — just a quieter sky.
          </p>
          <button
            type="button"
            onClick={start}
            className="mt-7 rounded-2xl bg-iris px-8 py-3.5 text-[15px] font-semibold text-ink-inverse shadow-float transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
          >
            Look up
          </button>
        </div>
      )}

      {stage === "tracing" && (
        <div className="rise-in flex flex-col items-center">
          <p className="mb-4 rounded-xl bg-surface-sunken px-3 py-1.5 text-[13px] font-bold text-ink-soft">
            {sky.name} · {lit} of {sky.points.length} stars
          </p>
          <div className="relative h-80 w-80 overflow-hidden rounded-[2rem] border border-border bg-surface-sunken shadow-card sm:h-96 sm:w-96">
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              {sky.points.slice(0, Math.max(0, lit - 1)).map(([x, y], i) => {
                const [nx, ny] = sky.points[i + 1]!;
                return (
                  <line
                    key={i}
                    x1={x * 100}
                    y1={y * 100}
                    x2={nx * 100}
                    y2={ny * 100}
                    className="stroke-iris"
                    strokeWidth="0.8"
                    strokeLinecap="round"
                    opacity="0.7"
                  />
                );
              })}
            </svg>
            {sky.points.map(([x, y], idx) => {
              const isLit = idx < lit;
              const isNext = idx === lit;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => tapStar(idx)}
                  aria-label={`Star ${idx + 1}${isLit ? ", lit" : isNext ? ", next" : ""}`}
                  className="absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
                  style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                >
                  <span
                    className={`block rounded-full transition-all ${
                      isLit
                        ? "size-3.5 bg-cat-butter shadow-float"
                        : isNext
                          ? "size-3 bg-iris motion-safe:animate-pulse"
                          : "size-2 bg-ink-faint opacity-60"
                    }`}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="rise-in flex max-w-sm flex-col items-center text-center">
          <p className="text-4xl" aria-hidden>
            🌌
          </p>
          <p className="mt-3 font-display text-3xl font-bold tracking-tight">
            {sky.name}, complete
          </p>
          <p className="mt-2 text-[14.5px] text-ink-soft">
            The sky doesn&apos;t hurry, and it always gets there. Neither do
            you, and neither will you.
          </p>
          <div className="mt-7 flex gap-2.5">
            <button
              type="button"
              onClick={start}
              className="rounded-2xl border border-border bg-surface px-5 py-2.5 text-[14px] font-semibold text-ink-soft shadow-card transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
            >
              Another sky
            </button>
            <button
              type="button"
              onClick={onExit}
              className="rounded-2xl bg-iris px-5 py-2.5 text-[14px] font-semibold text-ink-inverse shadow-card transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
            >
              Back to my day
            </button>
          </div>
        </div>
      )}
    </GameShell>
  );
}
