"use client";

/**
 * In Order — five everyday how-tos, steps shuffled. Tap the steps in the
 * order they belong; right picks lock into the plan, wrong picks wobble and
 * stay. Sequencing is executive-function work dressed as trivia — kept
 * mundane on purpose so the order is knowledge-free. Best = clean rebuilds
 * (no wobbles) out of 5.
 */
import { useRef, useState } from "react";
import {
  ORDER_BANK,
  ORDER_ROUNDS,
  prepareOrderRun,
  readBest,
  recordResult,
  scrambleOrder,
  type OrderItem,
} from "@/lib/games";
import { celebrate } from "../Celebration";
import { GameEnd, GameShell } from "./GameShell";

const ID = "in-order";

export function InOrder({ onExit }: { onExit: () => void }) {
  const [run, setRun] = useState(() => prepareOrderRun(ORDER_BANK));
  const rounds: OrderItem[] = run.rounds;
  const [roundIdx, setRoundIdx] = useState(0);
  const [scramble, setScramble] = useState<number[]>(run.scramble);
  const [placed, setPlaced] = useState(0);
  const [misses, setMisses] = useState(0);
  const [cleanCount, setCleanCount] = useState(0);
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(() => readBest(ID));
  const [isNewBest, setIsNewBest] = useState(false);
  const [done, setDone] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const item = rounds[roundIdx];
  const roundDone = item != null && placed >= item.steps.length;

  const start = () => {
    const next = prepareOrderRun(ORDER_BANK);
    setRun(next);
    setRoundIdx(0);
    setScramble(next.scramble);
    setPlaced(0);
    setMisses(0);
    setCleanCount(0);
    setFlashIdx(null);
    setIsNewBest(false);
    setDone(false);
    setBest(readBest(ID));
  };

  const tap = (stepIndex: number) => {
    if (!item || roundDone) return;
    if (stepIndex === placed) {
      const nowPlaced = placed + 1;
      setPlaced(nowPlaced);
      setFlashIdx(null);
      if (nowPlaced >= item.steps.length && misses === 0) {
        setCleanCount((c) => c + 1);
      }
    } else {
      setMisses((m) => m + 1);
      setFlashIdx(stepIndex);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashIdx(null), 600);
    }
  };

  const next = () => {
    if (roundIdx + 1 >= rounds.length) {
      const finalClean = cleanCount;
      const newBest = recordResult(ID, finalClean, "high");
      setIsNewBest(newBest);
      if (newBest)
        celebrate(window.innerWidth / 2, window.innerHeight / 2 - 80);
      setDone(true);
      return;
    }
    setRoundIdx((i) => i + 1);
    setScramble(scrambleOrder(rounds[roundIdx + 1]!.steps.length));
    setPlaced(0);
    setMisses(0);
    setFlashIdx(null);
  };

  return (
    <GameShell
      title="In Order"
      emoji="🧭"
      howTo="Steps, shuffled. Tap them in the order they belong."
      best={best != null ? `${best}/${ORDER_ROUNDS}` : null}
      onExit={onExit}
    >
      {!done && item && (
        <div className="rise-in w-full max-w-md">
          <p className="text-center text-[12px] font-bold uppercase tracking-[0.14em] text-ink-faint">
            {roundIdx + 1} of {rounds.length}
            {cleanCount > 0 && (
              <span className="text-success"> · {cleanCount} clean</span>
            )}
          </p>
          <h3 className="mt-4 text-center font-display text-2xl font-bold">
            {item.title}
          </h3>
          {placed > 0 && (
            <ol className="mt-5 grid gap-1.5">
              {item.steps.slice(0, placed).map((step, i) => (
                <li
                  key={step}
                  className="flex items-center gap-2.5 rounded-xl border border-success/30 bg-success-soft px-3.5 py-2 text-[14px] font-semibold text-success"
                >
                  <span className="tnum text-[12px] font-bold opacity-70">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          )}
          {!roundDone && (
            <div className="mt-4 grid gap-2">
              {scramble
                .filter((stepIndex) => stepIndex >= placed)
                .map((stepIndex) => {
                  const isFlash = flashIdx === stepIndex;
                  return (
                    <button
                      key={item.steps[stepIndex]}
                      type="button"
                      onClick={() => tap(stepIndex)}
                      className={`rounded-xl border px-3.5 py-2.5 text-left text-[14.5px] font-semibold shadow-card transition-all active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none ${
                        isFlash
                          ? "border-cat-butter-ink/30 bg-cat-butter text-cat-butter-ink"
                          : "border-border bg-surface text-ink hover:-translate-y-0.5 hover:shadow-float"
                      }`}
                    >
                      {item.steps[stepIndex]}
                    </button>
                  );
                })}
            </div>
          )}
          {roundDone && (
            <div className="rise-in mt-5 text-center">
              <p className="text-[14px] font-semibold">
                {misses === 0
                  ? "Clean rebuild — first try, every step."
                  : `Rebuilt with ${misses} wobble${misses === 1 ? "" : "s"}. Still counts as done.`}
              </p>
              <button
                type="button"
                onClick={next}
                className="mt-4 rounded-2xl bg-iris px-6 py-3 text-[14px] font-semibold text-ink-inverse shadow-card transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
              >
                {roundIdx + 1 >= rounds.length ? "See how it went" : "Next how-to"}
              </button>
            </div>
          )}
        </div>
      )}

      {done && (
        <GameEnd
          headline={`${cleanCount} of ${rounds.length} clean`}
          detail={
            cleanCount === ORDER_ROUNDS
              ? "Every sequence, first try. Executive function is showing off."
              : cleanCount >= 3
                ? "Solid sequencing — ordering steps in your head is real planning work."
                : "Shuffled steps are sneaky-hard. Every rebuild you finished still counts."
          }
          isNewBest={isNewBest}
          onAgain={start}
          onExit={onExit}
        />
      )}
    </GameShell>
  );
}
