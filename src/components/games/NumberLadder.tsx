"use client";

/**
 * Number Ladder — a six-rung mental-math climb. The current value and one
 * small operation at a time, three choices per rung, no timers and no
 * paper. Wrong picks show the right answer and the climb continues —
 * personal best = rungs right out of 6.
 */
import { useState } from "react";
import {
  LADDER_STEPS,
  buildLadder,
  readBest,
  recordResult,
  type Ladder,
} from "@/lib/games";
import { celebrate } from "../Celebration";
import { GameEnd, GameShell } from "./GameShell";

const ID = "number-ladder";

export function NumberLadder({ onExit }: { onExit: () => void }) {
  const [ladder, setLadder] = useState<Ladder>(() => buildLadder());
  const [rung, setRung] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState<number | null>(() => readBest(ID));
  const [isNewBest, setIsNewBest] = useState(false);
  const [done, setDone] = useState(false);

  const step = ladder.steps[rung];
  const prior = rung === 0 ? ladder.start : ladder.steps[rung - 1]!.result;
  const correct = step != null && chosen === step.result;

  const start = () => {
    setLadder(buildLadder());
    setRung(0);
    setChosen(null);
    setScore(0);
    setIsNewBest(false);
    setDone(false);
    setBest(readBest(ID));
  };

  const choose = (opt: number) => {
    if (chosen != null || !step) return;
    setChosen(opt);
    if (opt === step.result) setScore((s) => s + 1);
  };

  const next = () => {
    if (rung + 1 >= ladder.steps.length) {
      const newBest = recordResult(ID, score, "high");
      setIsNewBest(newBest);
      if (newBest)
        celebrate(window.innerWidth / 2, window.innerHeight / 2 - 80);
      setDone(true);
      return;
    }
    setRung((r) => r + 1);
    setChosen(null);
  };

  return (
    <GameShell
      title="Number Ladder"
      emoji="🪜"
      howTo="Start small. Climb one sum at a time — no paper allowed."
      best={best != null ? `${best}/${LADDER_STEPS}` : null}
      onExit={onExit}
    >
      {!done && step && (
        <div className="rise-in w-full max-w-sm text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-ink-faint">
            rung {rung + 1} of {ladder.steps.length}
            {score > 0 && (
              <span className="text-success"> · {score} right</span>
            )}
          </p>
          <div className="mt-7 flex items-baseline justify-center gap-3">
            <span className="tnum font-display text-5xl font-bold">
              {prior}
            </span>
            <span className="tnum rounded-xl bg-cat-peach px-3 py-1 font-display text-2xl font-bold text-cat-peach-ink">
              {step.op}
            </span>
            <span className="font-display text-3xl font-bold text-ink-faint">
              = ?
            </span>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-2.5">
            {step.options.map((opt) => {
              const isAnswer = opt === step.result;
              const isChosen = opt === chosen;
              let look =
                "border-border bg-surface text-ink hover:-translate-y-0.5 hover:shadow-float";
              if (chosen != null) {
                if (isAnswer)
                  look = "border-success/40 bg-success-soft text-success";
                else if (isChosen)
                  look = "border-cat-butter-ink/30 bg-cat-butter text-cat-butter-ink";
                else look = "border-border bg-surface opacity-55";
              }
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={chosen != null}
                  onClick={() => choose(opt)}
                  className={`tnum rounded-2xl border px-4 py-4 font-display text-2xl font-bold shadow-card transition-all active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none ${look}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {chosen != null && (
            <div className="rise-in mt-6">
              <p className="text-[14px] font-semibold">
                {correct
                  ? "Climbing."
                  : `It's ${step.result} — the ladder keeps going.`}
              </p>
              <button
                type="button"
                onClick={next}
                className="mt-4 rounded-2xl bg-iris px-6 py-3 text-[14px] font-semibold text-ink-inverse shadow-card transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
              >
                {rung + 1 >= ladder.steps.length ? "See how it went" : "Next rung"}
              </button>
            </div>
          )}
        </div>
      )}

      {done && (
        <GameEnd
          headline={`${score} of ${ladder.steps.length}`}
          detail={
            score === LADDER_STEPS
              ? "A clean climb, all in your head. Genuinely hard."
              : score >= 4
                ? "Solid climbing — carrying numbers in your head is real work."
                : "Mental math under a wandering mind is the hardest mode there is. It counts."
          }
          isNewBest={isNewBest}
          onAgain={start}
          onExit={onExit}
        />
      )}
    </GameShell>
  );
}
