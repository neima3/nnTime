"use client";

/**
 * Color Clash — the classic Stroop clash. A color word appears painted in a
 * different ink; tap the ink, not the word. Twelve rounds, best score kept.
 */
import { useEffect, useRef, useState } from "react";
import {
  buildClashRound,
  CLASH_COLOR_NAMES,
  CLASH_ROUNDS,
  readBest,
  recordResult,
  type ClashRound,
} from "@/lib/games";
import { celebrate } from "../Celebration";
import { GameEnd, GameShell } from "./GameShell";

type Stage = "intro" | "playing" | "done";

/* Literal class maps so Tailwind sees every token it needs. */
const INK_TEXT = [
  "text-cat-rose-ink",
  "text-cat-sky-ink",
  "text-cat-mint-ink",
  "text-cat-lilac-ink",
] as const;
const INK_DOT = [
  "bg-cat-rose-ink",
  "bg-cat-sky-ink",
  "bg-cat-mint-ink",
  "bg-cat-lilac-ink",
] as const;

export function ColorClash({ onExit }: { onExit: () => void }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [round, setRound] = useState<ClashRound>({ word: 0, ink: 1 });
  const [roundNo, setRoundNo] = useState(0);
  const [score, setScore] = useState(0);
  const [verdict, setVerdict] = useState<"right" | "wrong" | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setBest(readBest("color-clash"));
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const start = () => {
    setScore(0);
    setRoundNo(0);
    setVerdict(null);
    setIsNewBest(false);
    setBest(readBest("color-clash"));
    setRound(buildClashRound());
    setStage("playing");
  };

  const answer = (idx: number) => {
    if (stage !== "playing" || verdict != null) return;
    const right = idx === round.ink;
    const nextScore = right ? score + 1 : score;
    setScore(nextScore);
    setVerdict(right ? "right" : "wrong");
    timerRef.current = window.setTimeout(() => {
      setVerdict(null);
      const nextNo = roundNo + 1;
      if (nextNo >= CLASH_ROUNDS) {
        const newBest = recordResult("color-clash", nextScore, "high");
        setIsNewBest(newBest);
        if (newBest)
          celebrate(window.innerWidth / 2, window.innerHeight / 2 - 80);
        setStage("done");
        return;
      }
      setRoundNo(nextNo);
      setRound(buildClashRound());
    }, 420);
  };

  return (
    <GameShell
      title="Color Clash"
      emoji="🎨"
      howTo="Tap the ink it's painted in — not the word it spells."
      best={best != null ? `${best}/${CLASH_ROUNDS}` : null}
      onExit={onExit}
    >
      {stage === "intro" && (
        <div className="rise-in flex flex-col items-center text-center">
          <p className="max-w-xs text-[14.5px] text-ink-soft">
            Your reading brain and your seeing brain are about to disagree.
            Side with your eyes: tap the color the word is{" "}
            <em className="font-semibold not-italic">painted</em> in.
          </p>
          <button
            type="button"
            onClick={start}
            className="mt-7 rounded-2xl bg-iris px-8 py-3.5 text-[15px] font-semibold text-ink-inverse shadow-float transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
          >
            Bring the clash
          </button>
        </div>
      )}

      {stage === "playing" && (
        <div className="rise-in flex w-full max-w-sm flex-col items-center">
          <p className="tnum mb-6 text-[13px] font-semibold text-ink-soft">
            round {roundNo + 1} of {CLASH_ROUNDS} · {score} right
          </p>
          <div
            className={`grid h-32 w-full place-items-center rounded-3xl border bg-surface shadow-card transition-colors ${
              verdict === "right"
                ? "border-success/40 bg-success-soft"
                : verdict === "wrong"
                  ? "border-danger/40 bg-danger-soft"
                  : "border-border"
            }`}
          >
            <span
              className={`font-display text-5xl font-bold tracking-tight ${INK_TEXT[round.ink]}`}
            >
              {CLASH_COLOR_NAMES[round.word]}
            </span>
          </div>
          <div className="mt-6 grid w-full grid-cols-2 gap-2.5">
            {CLASH_COLOR_NAMES.map((name, idx) => (
              <button
                key={name}
                type="button"
                onClick={() => answer(idx)}
                className="flex items-center justify-center gap-2.5 rounded-2xl border border-border bg-surface px-4 py-3.5 text-[14.5px] font-semibold text-ink shadow-card transition-all hover:-translate-y-0.5 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
              >
                <span
                  className={`size-3.5 rounded-full ${INK_DOT[idx]}`}
                  aria-hidden
                />
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {stage === "done" && (
        <GameEnd
          headline={`${score} of ${CLASH_ROUNDS} clashes won`}
          detail={
            score >= 10
              ? "Your seeing brain runs this town. The words never stood a chance."
              : score >= 6
                ? "Reading is automatic — overriding it even half the time is real focus work."
                : "The clash is rigged: brains read faster than they see. Another round evens the odds."
          }
          isNewBest={isNewBest}
          onAgain={start}
          onExit={onExit}
        />
      )}
    </GameShell>
  );
}
