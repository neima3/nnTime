"use client";

/**
 * Shared word-quiz engine (Grammar Snap + Spell Check). Eight rounds, tap a
 * choice, instant kind feedback with a one-line memory hook, no timers and
 * no red — a wrong tap teaches instead of stings. Personal best = correct
 * answers out of 8.
 *
 * Misses are remembered (localStorage): once three pile up, the intro
 * offers "your tricky ones" — a practice run of exactly the snags that got
 * you, and answering one right redeems it off the list.
 */
import { useEffect, useState } from "react";
import {
  QUIZ_ROUNDS,
  QUIZ_TOPIC_LABELS,
  clearMiss,
  missedItems,
  pickQuizRounds,
  readBest,
  readMisses,
  recordMiss,
  recordResult,
  type GameId,
  type QuizItem,
} from "@/lib/games";
import { celebrate } from "../Celebration";
import { GameEnd, GameShell } from "./GameShell";

const PRACTICE_OFFER_AT = 3;

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
  const [mode, setMode] = useState<"choose" | "fresh" | "practice">("choose");
  const [rounds, setRounds] = useState<QuizItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const [missCount, setMissCount] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setBest(readBest(id));
    const misses = readMisses(id);
    setMissCount(misses.length);
    // No pile of tricky ones yet → skip the chooser, straight into a run.
    if (misses.length < PRACTICE_OFFER_AT) {
      setRounds(pickQuizRounds(bank));
      setMode("fresh");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [id, bank]);

  const startFresh = () => {
    setRounds(pickQuizRounds(bank));
    setIdx(0);
    setChosen(null);
    setScore(0);
    setIsNewBest(false);
    setDone(false);
    setBest(readBest(id));
    setMode("fresh");
  };

  const startPractice = () => {
    const pool = missedItems(bank, readMisses(id));
    setRounds(pickQuizRounds(pool, QUIZ_ROUNDS, Math.random, { maxPerTopic: 99 }));
    setIdx(0);
    setChosen(null);
    setScore(0);
    setIsNewBest(false);
    setDone(false);
    setMode("practice");
  };

  const item = rounds[idx];
  const correct = item != null && chosen != null && chosen === item.answer;

  const choose = (opt: string) => {
    if (chosen != null || !item) return;
    setChosen(opt);
    if (opt === item.answer) {
      setScore((s) => s + 1);
      clearMiss(id, item.prompt);
    } else {
      recordMiss(id, item.prompt);
    }
  };

  const next = () => {
    if (idx + 1 >= rounds.length) {
      // Only fresh runs compete with your best — practice is for redemption.
      if (mode === "fresh") {
        const newBest = recordResult(id, score, "high");
        setIsNewBest(newBest);
        if (newBest)
          celebrate(window.innerWidth / 2, window.innerHeight / 2 - 80);
      }
      setMissCount(readMisses(id).length);
      setDone(true);
      return;
    }
    setIdx((i) => i + 1);
    setChosen(null);
  };

  const topicLabel = item?.topic ? QUIZ_TOPIC_LABELS[item.topic] : null;

  return (
    <GameShell
      title={title}
      emoji={emoji}
      howTo={howTo}
      best={best != null ? `${best}/${QUIZ_ROUNDS}` : null}
      onExit={onExit}
    >
      {mode === "choose" && (
        <div className="rise-in flex max-w-sm flex-col items-center text-center">
          <p className="text-[14.5px] text-ink-soft">
            You&apos;ve got {missCount} tricky ones saved up — the exact snags
            that got you before. Face them, or draw fresh?
          </p>
          <div className="mt-7 grid w-full gap-2.5">
            <button
              type="button"
              onClick={startPractice}
              className="rounded-2xl bg-iris px-6 py-3.5 text-[15px] font-semibold text-ink-inverse shadow-card transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
            >
              My tricky ones ({Math.min(missCount, QUIZ_ROUNDS)})
            </button>
            <button
              type="button"
              onClick={startFresh}
              className="rounded-2xl border border-border bg-surface px-6 py-3.5 text-[15px] font-semibold text-ink-soft shadow-card transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
            >
              Fresh eight
            </button>
          </div>
          <p className="mt-4 text-[12px] text-ink-faint">
            Answer a tricky one right and it leaves the list for good.
          </p>
        </div>
      )}

      {mode !== "choose" && !done && item && (
        <div className="rise-in w-full max-w-md">
          <p className="text-center text-[12px] font-bold uppercase tracking-[0.14em] text-ink-faint">
            {mode === "practice" && (
              <span className="text-iris">practice · </span>
            )}
            {idx + 1} of {rounds.length}
            {score > 0 && <span className="text-success"> · {score} right</span>}
            {topicLabel && (
              <span className="ml-1.5 rounded-md bg-surface-sunken px-1.5 py-0.5 normal-case tracking-normal">
                {topicLabel}
              </span>
            )}
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
                {correct
                  ? mode === "practice"
                    ? "Redeemed — off the tricky list it goes."
                    : "Yes — nailed it."
                  : "Close one — now you've got it."}
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
      )}

      {done && (
        <GameEnd
          headline={`${score} of ${rounds.length}`}
          detail={
            mode === "practice"
              ? score === rounds.length
                ? "Full redemption — every one of those had beaten you before. Not anymore."
                : `${score} redeemed, ${rounds.length - score} still lurking. They'll be here when you want them.`
              : endDetail(score)
          }
          isNewBest={isNewBest}
          onAgain={startFresh}
          onExit={onExit}
        />
      )}
    </GameShell>
  );
}
