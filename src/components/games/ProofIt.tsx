"use client";

/**
 * Proof It — each round is one sentence hiding exactly one wrong word
 * (sound-alike, spelling slip, tense wobble, doubled word…). Tap the word
 * that's wrong. Eight rounds, instant kind feedback with the corrected
 * sentence and a memory hook. Misses are remembered for practice runs,
 * exactly like the quizzes. Personal best = finds out of 8.
 */
import { useEffect, useState } from "react";
import {
  PROOF_BANK,
  PROOF_ROUNDS,
  QUIZ_TOPIC_LABELS,
  clearMiss,
  isProofHit,
  pickProofRounds,
  proofCorrected,
  proofMissedItems,
  proofWords,
  readBest,
  readMisses,
  recordMiss,
  recordResult,
  type ProofItem,
} from "@/lib/games";
import { celebrate } from "../Celebration";
import { GameEnd, GameShell } from "./GameShell";

const ID = "proof-it";
const PRACTICE_OFFER_AT = 3;

export function ProofIt({ onExit }: { onExit: () => void }) {
  const [mode, setMode] = useState<"choose" | "fresh" | "practice">("choose");
  const [rounds, setRounds] = useState<ProofItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [tapped, setTapped] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const [missCount, setMissCount] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setBest(readBest(ID));
    const misses = readMisses(ID);
    setMissCount(misses.length);
    if (misses.length < PRACTICE_OFFER_AT) {
      setRounds(pickProofRounds(PROOF_BANK));
      setMode("fresh");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const startFresh = () => {
    setRounds(pickProofRounds(PROOF_BANK));
    setIdx(0);
    setTapped(null);
    setScore(0);
    setIsNewBest(false);
    setDone(false);
    setBest(readBest(ID));
    setMode("fresh");
  };

  const startPractice = () => {
    const pool = proofMissedItems(PROOF_BANK, readMisses(ID));
    setRounds(pickProofRounds(pool, PROOF_ROUNDS, Math.random, { maxPerTopic: 99 }));
    setIdx(0);
    setTapped(null);
    setScore(0);
    setIsNewBest(false);
    setDone(false);
    setMode("practice");
  };

  const item = rounds[idx];
  const found = item != null && tapped != null && isProofHit(item, tapped);

  const tap = (wordIndex: number) => {
    if (tapped != null || !item) return;
    setTapped(wordIndex);
    if (isProofHit(item, wordIndex)) {
      setScore((s) => s + 1);
      clearMiss(ID, item.text);
    } else {
      recordMiss(ID, item.text);
    }
  };

  const next = () => {
    if (idx + 1 >= rounds.length) {
      if (mode === "fresh") {
        const newBest = recordResult(ID, score, "high");
        setIsNewBest(newBest);
        if (newBest)
          celebrate(window.innerWidth / 2, window.innerHeight / 2 - 80);
      }
      setMissCount(readMisses(ID).length);
      setDone(true);
      return;
    }
    setIdx((i) => i + 1);
    setTapped(null);
  };

  const topicLabel = item?.topic ? QUIZ_TOPIC_LABELS[item.topic] : null;

  return (
    <GameShell
      title="Proof It"
      emoji="✏️"
      howTo="One word in each sentence is wrong. Tap it."
      best={best != null ? `${best}/${PROOF_ROUNDS}` : null}
      onExit={onExit}
    >
      {mode === "choose" && (
        <div className="rise-in flex max-w-sm flex-col items-center text-center">
          <p className="text-[14.5px] text-ink-soft">
            You&apos;ve got {missCount} sentences that slipped past you before.
            Re-read them with fresh eyes, or draw new ones?
          </p>
          <div className="mt-7 grid w-full gap-2.5">
            <button
              type="button"
              onClick={startPractice}
              className="rounded-2xl bg-iris px-6 py-3.5 text-[15px] font-semibold text-ink-inverse shadow-card transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
            >
              My slippery ones ({Math.min(missCount, PROOF_ROUNDS)})
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
            Spot one on the reread and it leaves the list for good.
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
            {score > 0 && <span className="text-success"> · {score} found</span>}
            {topicLabel && (
              <span className="ml-1.5 rounded-md bg-surface-sunken px-1.5 py-0.5 normal-case tracking-normal">
                {topicLabel}
              </span>
            )}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-x-1.5 gap-y-2.5">
            {proofWords(item).map((word, i) => {
              const isError = isProofHit(item, i);
              const isTapped = i === tapped;
              let look =
                "border-border bg-surface text-ink hover:-translate-y-0.5 hover:shadow-float cursor-pointer";
              if (tapped != null) {
                if (isError)
                  look = "border-success/40 bg-success-soft text-success";
                else if (isTapped)
                  look = "border-cat-butter-ink/30 bg-cat-butter text-cat-butter-ink";
                else look = "border-border bg-surface opacity-55";
              }
              return (
                <button
                  key={`${i}-${word}`}
                  type="button"
                  disabled={tapped != null}
                  onClick={() => tap(i)}
                  className={`rounded-xl border px-2.5 py-1.5 font-display text-[18px] font-semibold shadow-card transition-all active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none ${look}`}
                >
                  {word}
                </button>
              );
            })}
          </div>
          {tapped != null && (
            <div className="rise-in mt-6 text-center">
              <p className="text-[14px] font-semibold">
                {found
                  ? mode === "practice"
                    ? "Caught it — off the slippery list it goes."
                    : "Sharp eye."
                  : "That one's fine — the sneaky one is highlighted."}
              </p>
              <p className="mt-2 rounded-xl bg-surface-sunken px-4 py-2.5 text-[14.5px] font-medium text-ink">
                {proofCorrected(item)}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
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
                ? "Every one of those had slipped past you before. Not today."
                : `${score} caught, ${rounds.length - score} still sneaky. They'll wait.`
              : score >= 7
                ? "Editor eyes. Nothing gets past you."
                : score >= 4
                  ? "Solid proofreading — these are built to be invisible."
                  : "These errors fool people who read for a living. Now you know their disguises."
          }
          isNewBest={isNewBest}
          onAgain={startFresh}
          onExit={onExit}
        />
      )}
    </GameShell>
  );
}
