"use client";

/**
 * Shared word-quiz engine (Grammar Snap + Spell Check). Eight rounds, tap a
 * choice, instant kind feedback with a one-line memory hook, no timers and
 * no red — a wrong tap teaches instead of stings. Personal best = correct
 * answers out of 8.
 */
import { useEffect, useState } from "react";
import {
  QUIZ_ROUNDS,
  pickQuizRounds,
  readBest,
  recordResult,
  type GameId,
  type QuizItem,
} from "@/lib/games";
import { celebrate } from "../Celebration";
import { GameEnd, GameShell } from "./GameShell";

export function QuizGame({
  id,
  title,
  emoji,
  howTo,
  bank,
  endDetail,
  onExit,
}: {
  id: GameId;
  title: string;
  emoji: string;
  howTo: string;
  bank: QuizItem[];
  endDetail: (score: number) => string;
  onExit: () => void;
}) {
  const [rounds, setRounds] = useState<QuizItem[]>(() => pickQuizRounds(bank));
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setBest(readBest(id));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [id]);

  const item = rounds[idx]!;
  const correct = chosen != null && chosen === item.answer;

  const choose = (opt: string) => {
    if (chosen != null) return;
    setChosen(opt);
    if (opt === item.answer) setScore((s) => s + 1);
  };

  const next = () => {
    const finalScore = score;
    if (idx + 1 >= rounds.length) {
      const newBest = recordResult(id, finalScore, "high");
      setIsNewBest(newBest);
      if (newBest) celebrate(window.innerWidth / 2, window.innerHeight / 2 - 80);
      setDone(true);
      return;
    }
    setIdx((i) => i + 1);
    setChosen(null);
  };

  const restart = () => {
    setRounds(pickQuizRounds(bank));
    setIdx(0);
    setChosen(null);
    setScore(0);
    setIsNewBest(false);
    setBest(readBest(id));
    setDone(false);
  };

  return (
    <GameShell
      title={title}
      emoji={emoji}
      howTo={howTo}
      best={best != null ? `${best}/${QUIZ_ROUNDS}` : null}
      onExit={onExit}
    >
      {!done ? (
        <div className="rise-in w-full max-w-md">
          <p className="text-center text-[12px] font-bold uppercase tracking-[0.14em] text-ink-faint">
            {idx + 1} of {rounds.length}
            {score > 0 && <span className="text-success"> · {score} right</span>}
          </p>
          <p className="mt-5 text-center font-display text-2xl font-bold leading-snug">
            {item.prompt}
          </p>
          <div className="mt-7 grid gap-2.5">
            {item.options.map((opt) => {
              const isAnswer = opt === item.answer;
              const isChosen = opt === chosen;
              let look =
                "border-border bg-surface text-ink hover:-translate-y-0.5 hover:shadow-float";
              if (chosen != null) {
                if (isAnswer)
                  look = "border-success/40 bg-success-soft text-success";
                else if (isChosen)
                  look = "border-cat-butter-ink/30 bg-cat-butter text-cat-butter-ink";
                else look = "border-border bg-surface opacity-50";
              }
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={chosen != null}
                  onClick={() => choose(opt)}
                  className={`rounded-2xl border px-5 py-3.5 text-[16px] font-semibold shadow-card transition-all active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none ${look}`}
                >
                  {opt}
                  {chosen != null && isAnswer && " ✓"}
                </button>
              );
            })}
          </div>
          {chosen != null && (
            <div className="rise-in mt-5 text-center">
              <p className="text-[14px] font-semibold">
                {correct ? "Yes — nailed it." : "Close one — now you've got it."}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                {item.note}
              </p>
              <button
                type="button"
                onClick={next}
                className="mt-5 rounded-2xl bg-iris px-6 py-3 text-[14px] font-semibold text-ink-inverse shadow-card transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
              >
                {idx + 1 >= rounds.length ? "See how it went" : "Next one"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <GameEnd
          headline={`${score} of ${rounds.length}`}
          detail={endDetail(score)}
          isNewBest={isNewBest}
          onAgain={restart}
          onExit={onExit}
        />
      )}
    </GameShell>
  );
}
