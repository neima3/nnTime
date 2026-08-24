"use client";

/**
 * Shared word-quiz engine (Grammar Snap + Spell Check). Eight rounds, tap a
 * choice, instant kind feedback, no timers and no red — a wrong tap teaches
 * instead of stings. After every answer the sentence completes itself, the
 * one-line memory hook lands, and each real-word option shows up used
 * correctly in the wild (the distinction, not just the answer). Spelling
 * answers underline their trap letters. Personal best = correct out of 8.
 *
 * Misses are remembered (localStorage): once three pile up, the intro
 * offers "your tricky ones" — a practice run of exactly the snags that got
 * you, and answering one right redeems it off the list. The end screen
 * recaps the rules from this run's misses so they leave with you.
 */
import { Fragment, useEffect, useRef, useState } from "react";
import {
  QUIZ_ROUNDS,
  QUIZ_TOPIC_LABELS,
  clearMiss,
  missedItems,
  pickQuizRounds,
  pruneMisses,
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
const RECAP_CAP = 3;

/** The answer, with its trap letters underlined when the item marks them. */
function StressedAnswer({ item }: { item: QuizItem }) {
  const { answer, stress } = item;
  if (!stress) return <>{answer}</>;
  const at = answer.indexOf(stress);
  if (at < 0) return <>{answer}</>;
  return (
    <>
      {answer.slice(0, at)}
      <span className="underline decoration-2 underline-offset-4">{stress}</span>
      {answer.slice(at + stress.length)}
    </>
  );
}

/** The prompt with its blank filled by the (highlighted) right answer. */
function FilledPrompt({ item }: { item: QuizItem }) {
  const parts = item.prompt.split("___");
  if (parts.length < 2) return <>{item.prompt}</>;
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && (
            <span className="text-success">
              <StressedAnswer item={item} />
            </span>
          )}
        </Fragment>
      ))}
    </>
  );
}

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
  const [missedThisRun, setMissedThisRun] = useState<QuizItem[]>([]);
  const [isNewBest, setIsNewBest] = useState(false);
  const [done, setDone] = useState(false);
  // Refs mirror chosen/finished so rapid double-taps in one React batch
  // (stale closures) can't answer twice, skip a question, or blank the run.
  const chosenRef = useRef<string | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setBest(readBest(id));
    // Prune first: a reworded/retired bank item must not haunt the count.
    const misses = pruneMisses(id, bank);
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
    setMissedThisRun([]);
    setIsNewBest(false);
    setDone(false);
    setBest(readBest(id));
    chosenRef.current = null;
    finishedRef.current = false;
    setMode("fresh");
  };

  const startPractice = () => {
    const pool = missedItems(bank, readMisses(id));
    setRounds(pickQuizRounds(pool, QUIZ_ROUNDS, Math.random, { maxPerTopic: 99 }));
    setIdx(0);
    setChosen(null);
    setScore(0);
    setMissedThisRun([]);
    setIsNewBest(false);
    setDone(false);
    chosenRef.current = null;
    finishedRef.current = false;
    setMode("practice");
  };

  const item = rounds[idx];
  const correct = item != null && chosen != null && chosen === item.answer;

  const choose = (opt: string) => {
    if (chosenRef.current != null || chosen != null || !item) return;
    chosenRef.current = opt;
    setChosen(opt);
    if (opt === item.answer) {
      setScore((s) => s + 1);
      clearMiss(id, item.prompt);
    } else {
      recordMiss(id, item.prompt);
      setMissedThisRun((list) => [...list, item]);
    }
  };

  const next = () => {
    if (done || finishedRef.current) return;
    if (idx + 1 >= rounds.length) {
      finishedRef.current = true;
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
    // Absolute (not functional) so a same-batch double-tap is idempotent
    // instead of skipping a question or walking idx off the end.
    setIdx(idx + 1);
    setChosen(null);
    chosenRef.current = null;
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
            {chosen == null ? item.prompt : <FilledPrompt item={item} />}
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
          {/* Live region stays mounted so the verdict announces reliably;
              content swaps in only after an answer. */}
          <div role="status" className="text-center">
            {chosen != null && (
              <div className="rise-in mt-5">
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
              </div>
            )}
          </div>
          {chosen != null && (
            <div className="rise-in text-center">
              {item.examples && item.examples.length > 0 && (
                <div className="mx-auto mt-3 w-full max-w-sm rounded-2xl bg-surface-sunken px-4 py-3 text-left">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-faint">
                    {item.examples.length > 1 ? "Each one, used right" : "Used right"}
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {item.examples.map((ex) => (
                      <li key={ex.word} className="text-[13px] leading-snug text-ink-soft">
                        <span className="font-semibold text-ink">{ex.word}</span>
                        {" — "}
                        {ex.sample}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
        <div className="flex w-full max-w-sm flex-col items-center">
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
          {missedThisRun.length > 0 && (
            <div className="rise-in mt-6 w-full rounded-2xl border border-border bg-surface p-4 text-left shadow-card">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-faint">
                Pocket these
              </p>
              <ul className="mt-2 space-y-2">
                {missedThisRun.slice(0, RECAP_CAP).map((m) => (
                  <li key={m.prompt} className="text-[12.5px] leading-snug text-ink-soft">
                    <span className="font-semibold text-ink">{m.answer}</span>
                    {" — "}
                    {m.note}
                  </li>
                ))}
              </ul>
              {missedThisRun.length > RECAP_CAP && (
                <p className="mt-2 text-[11.5px] text-ink-faint">
                  …and {missedThisRun.length - RECAP_CAP} more, saved with your
                  tricky ones.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </GameShell>
  );
}
