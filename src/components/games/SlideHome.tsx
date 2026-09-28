"use client";

/**
 * Slide Home — the 3×3 sliding puzzle, untimed. Each tile wears the colour
 * of the row it belongs in, so the board settles into three calm bands as
 * it comes home. Every board is generated with a known shortest path (par);
 * the personal best is how close to par you got, so a hard board and an easy
 * one are judged on the same terms.
 */
import { useCallback, useEffect, useState } from "react";
import {
  buildSlideBoard,
  isSlideSolved,
  readBest,
  recordResult,
  SLIDE_SIDE,
  slideKeyTarget,
  slideNeighbors,
  slideTap,
} from "@/lib/games";
import { celebrate } from "../Celebration";
import { GameEnd, GameShell } from "./GameShell";

type Stage = "intro" | "playing" | "done";

const ROW_TINT = [
  "bg-cat-butter text-cat-butter-ink",
  "bg-cat-peach text-cat-peach-ink",
  "bg-cat-mint text-cat-mint-ink",
] as const;

function homeRow(tile: number) {
  return Math.floor((tile - 1) / SLIDE_SIDE);
}

function direction(from: number, to: number) {
  if (to === from - SLIDE_SIDE) return "up";
  if (to === from + SLIDE_SIDE) return "down";
  return to === from - 1 ? "left" : "right";
}

function overParLabel(v: number) {
  return v === 0 ? "on par" : `par +${v}`;
}

export function SlideHome({ onExit }: { onExit: () => void }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [board, setBoard] = useState<number[]>([]);
  const [par, setPar] = useState(0);
  const [moves, setMoves] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setBest(readBest("slide-home"));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const start = useCallback(() => {
    const next = buildSlideBoard();
    setBoard(next.board);
    setPar(next.par);
    setMoves(0);
    setIsNewBest(false);
    setBest(readBest("slide-home"));
    setStage("playing");
  }, []);

  const slide = useCallback(
    (cell: number) => {
      if (stage !== "playing") return;
      const next = slideTap(board, cell);
      if (!next) return;
      const count = moves + 1;
      setBoard(next);
      setMoves(count);
      if (isSlideSolved(next)) {
        const newBest = recordResult("slide-home", Math.max(0, count - par), "low");
        setIsNewBest(newBest);
        if (newBest) celebrate(window.innerWidth / 2, window.innerHeight / 2 - 80);
        window.setTimeout(() => setStage("done"), 650);
      }
    },
    [stage, board, moves, par],
  );

  useEffect(() => {
    const keys: Record<string, "up" | "down" | "left" | "right"> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };
    const onKey = (e: KeyboardEvent) => {
      const key = keys[e.key];
      if (!key || stage !== "playing" || isSlideSolved(board)) return;
      e.preventDefault();
      const target = slideKeyTarget(board, key);
      if (target != null) slide(target);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, board, slide]);

  const gap = board.indexOf(0);
  const movable = gap >= 0 ? slideNeighbors(gap) : [];
  const solved = board.length > 0 && isSlideSolved(board);

  return (
    <GameShell
      title="Slide Home"
      emoji="🏡"
      howTo="Slide the tiles until every row is back in its colour. Nothing is timed."
      best={best != null ? overParLabel(best) : null}
      onExit={onExit}
    >
      {stage === "intro" && (
        <div className="rise-in flex flex-col items-center text-center">
          <div className="grid grid-cols-3 gap-1.5" aria-hidden>
            {[1, 2, 3, 4, 5, 6, 7, 8, 0].map((t) => (
              <span
                key={t}
                className={`grid size-11 place-items-center rounded-xl font-display text-[15px] font-bold ${
                  t === 0 ? "bg-surface-sunken" : ROW_TINT[homeRow(t)]
                }`}
              >
                {t || ""}
              </span>
            ))}
          </div>
          <p className="mt-6 max-w-xs text-[14.5px] text-ink-soft">
            Eight tiles, one gap. Tap a tile beside the gap to slide it (arrow
            keys work too). Get them home — every board has a par, but there
            is no clock.
          </p>
          <button
            type="button"
            onClick={start}
            className="mt-7 rounded-2xl bg-iris px-8 py-3.5 text-[15px] font-semibold text-ink-inverse shadow-float transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
          >
            Scatter the tiles
          </button>
        </div>
      )}

      {stage === "playing" && (
        <div className="rise-in flex w-full flex-col items-center">
          <div className="mb-5 flex items-center gap-3">
            <p className="tnum rounded-xl bg-surface-sunken px-3 py-1.5 text-[13px] font-bold text-ink-soft" aria-live="polite">
              {moves} {moves === 1 ? "move" : "moves"} · par {par}
            </p>
            <button
              type="button"
              onClick={start}
              className="rounded-xl px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-faint hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
            >
              New board
            </button>
          </div>

          <div
            className={`relative aspect-square w-[min(78vw,20rem)] rounded-[1.75rem] border p-2 shadow-float transition-colors ${
              solved
                ? "border-success/60 bg-surface-sunken ring-4 ring-success/15"
                : "border-border bg-surface-sunken"
            }`}
            role="group"
            aria-label="Sliding puzzle"
          >
            <div className="relative size-full">
              {board.map((tile, cell) => {
                if (tile === 0) return null;
                const row = Math.floor(cell / SLIDE_SIDE);
                const col = cell % SLIDE_SIDE;
                const canMove = movable.includes(cell) && !solved;
                const home = tile === cell + 1;
                return (
                  <button
                    key={tile}
                    type="button"
                    onClick={() => slide(cell)}
                    aria-disabled={!canMove}
                    aria-label={`Tile ${tile}${home ? ", home" : ""}${canMove ? `, slides ${direction(cell, gap)}` : ""}`}
                    style={{
                      width: "calc((100% - 1rem) / 3)",
                      height: "calc((100% - 1rem) / 3)",
                      transform: `translate(calc(${col} * (100% + 0.5rem)), calc(${row} * (100% + 0.5rem)))`,
                    }}
                    className={`absolute top-0 left-0 grid place-items-center rounded-2xl font-display text-2xl font-bold shadow-card transition-transform duration-200 ease-out motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none ${
                      ROW_TINT[homeRow(tile)]
                    } ${canMove ? "cursor-pointer active:scale-95" : "cursor-default"}`}
                  >
                    {tile}
                    {home && (
                      <span
                        className="absolute right-2 bottom-2 size-1.5 rounded-full bg-current opacity-45"
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2.5 text-[12px] font-semibold text-ink-faint" aria-hidden>
            <span>home looks like</span>
            <span className="grid grid-cols-3 gap-0.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 0].map((t) => (
                <span
                  key={t}
                  className={`size-2.5 rounded-[3px] ${t === 0 ? "bg-surface-sunken" : ROW_TINT[homeRow(t)]}`}
                />
              ))}
            </span>
          </div>
        </div>
      )}

      {stage === "done" && (
        <GameEnd
          headline={`Home in ${moves} moves`}
          detail={
            moves <= par
              ? `That's par — ${par} is the shortest path there is. Tidy.`
              : moves - par <= 6
                ? `Only ${moves - par} over par (${par}). The tiles barely noticed the detours.`
                : `Par was ${par}. Every slide counted — and nobody was timing you.`
          }
          isNewBest={isNewBest}
          onAgain={start}
          onExit={onExit}
        />
      )}
    </GameShell>
  );
}
