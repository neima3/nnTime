"use client";

/**
 * Arrow Rush — the flanker task. Five arrows, answer only for the middle
 * one; half the time its neighbours point the other way. Twenty quick
 * rounds; right answers out of 20 is the personal best, and the end screen
 * names the one number worth noticing: how much the decoys slowed you.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  ARROW_GAP_MS,
  ARROW_LIMIT_MS,
  ARROW_ROUNDS,
  arrowRow,
  arrowSummary,
  buildArrowRun,
  readBest,
  recordResult,
  type ArrowDir,
  type ArrowResult,
  type ArrowRound,
} from "@/lib/games";
import { celebrate } from "../Celebration";
import { GameEnd, GameShell } from "./GameShell";

type Stage = "intro" | "playing" | "done";
type Verdict = "right" | "wrong" | "slow" | null;

function Arrows({ row, size }: { row: ArrowDir[]; size: number }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-3" aria-hidden>
      {row.map((dir, i) =>
        dir === "left" ? (
          <ArrowLeft key={i} size={size} strokeWidth={2.6} />
        ) : (
          <ArrowRight key={i} size={size} strokeWidth={2.6} />
        ),
      )}
    </div>
  );
}

export function ArrowRush({ onExit }: { onExit: () => void }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [round, setRound] = useState<ArrowRound | null>(null);
  const [idx, setIdx] = useState(0);
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [results, setResults] = useState<ArrowResult[]>([]);
  const [best, setBest] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const runRef = useRef<ArrowRound[]>([]);
  const resultsRef = useRef<ArrowResult[]>([]);
  const shownAt = useRef(0);
  const open = useRef(false);
  const timers = useRef<number[]>([]);
  const showNext = useRef<(i: number) => void>(() => {});

  const clearTimers = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setBest(readBest("arrow-rush"));
    /* eslint-enable react-hooks/set-state-in-effect */
    return clearTimers;
  }, []);

  const finish = useCallback(() => {
    const { correct } = arrowSummary(resultsRef.current);
    const newBest = recordResult("arrow-rush", correct, "high");
    setIsNewBest(newBest);
    if (newBest) celebrate(window.innerWidth / 2, window.innerHeight / 2 - 80);
    setStage("done");
  }, []);

  const show = useCallback(
    (i: number) => {
      if (i >= runRef.current.length) {
        finish();
        return;
      }
      setIdx(i);
      setRound(runRef.current[i]!);
      setVerdict(null);
      shownAt.current = performance.now();
      open.current = true;
      later(() => {
        if (!open.current) return;
        open.current = false;
        const r = runRef.current[i]!;
        resultsRef.current = [
          ...resultsRef.current,
          { congruent: r.congruent, correct: false, ms: null },
        ];
        setResults(resultsRef.current);
        setVerdict("slow");
        later(() => showNext.current(i + 1), ARROW_GAP_MS + 220);
      }, ARROW_LIMIT_MS);
    },
    [finish],
  );

  useEffect(() => {
    showNext.current = show;
  }, [show]);

  const start = useCallback(() => {
    clearTimers();
    runRef.current = buildArrowRun();
    resultsRef.current = [];
    setResults([]);
    setIsNewBest(false);
    setBest(readBest("arrow-rush"));
    setRound(null);
    setIdx(0);
    setStage("playing");
    later(() => show(0), 650);
  }, [show]);

  const answer = useCallback(
    (dir: ArrowDir) => {
      if (stage !== "playing" || !open.current || !round) return;
      open.current = false;
      clearTimers();
      const ms = Math.round(performance.now() - shownAt.current);
      const correct = dir === round.dir;
      resultsRef.current = [
        ...resultsRef.current,
        { congruent: round.congruent, correct, ms },
      ];
      setResults(resultsRef.current);
      setVerdict(correct ? "right" : "wrong");
      later(() => show(idx + 1), ARROW_GAP_MS);
    },
    [stage, round, idx, show],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (stage === "playing" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        answer(e.key === "ArrowLeft" ? "left" : "right");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, answer]);

  const summary = arrowSummary(results);

  return (
    <GameShell
      title="Arrow Rush"
      emoji="🏹"
      howTo="Which way does the middle arrow point? Ignore the crowd."
      best={best != null ? `${best}/${ARROW_ROUNDS}` : null}
      onExit={onExit}
    >
      {stage === "intro" && (
        <div className="rise-in flex flex-col items-center text-center">
          <div className="rounded-3xl border border-border bg-surface px-6 py-5 text-ink shadow-card">
            <Arrows row={arrowRow({ dir: "left", congruent: false })} size={30} />
          </div>
          <p className="mt-2 text-[12.5px] font-semibold text-ink-faint">
            here the answer is ← — the middle one
          </p>
          <p className="mt-5 max-w-xs text-[14.5px] text-ink-soft">
            Twenty quick rows. Tap (or press ← →) for the middle arrow only.
            Half the time its neighbours point the other way, on purpose.
          </p>
          <button
            type="button"
            onClick={start}
            className="mt-7 rounded-2xl bg-iris px-8 py-3.5 text-[15px] font-semibold text-ink-inverse shadow-float transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
          >
            Start the rush
          </button>
        </div>
      )}

      {stage === "playing" && (
        <div className="rise-in flex w-full max-w-md flex-col items-center">
          <div
            className="mb-5 flex gap-1"
            role="progressbar"
            aria-label="Rounds"
            aria-valuemin={0}
            aria-valuemax={ARROW_ROUNDS}
            aria-valuenow={results.length}
          >
            {Array.from({ length: ARROW_ROUNDS }, (_, i) => {
              const r = results[i];
              return (
                <span
                  key={i}
                  className={`h-1.5 w-2.5 rounded-full transition-colors sm:w-3.5 ${
                    r == null
                      ? i === idx
                        ? "bg-iris/40"
                        : "bg-surface-sunken"
                      : r.correct
                        ? "bg-success"
                        : "bg-danger/70"
                  }`}
                />
              );
            })}
          </div>

          <div
            className={`grid h-36 w-full place-items-center rounded-[2rem] border-2 shadow-float transition-colors sm:h-40 ${
              verdict === "right"
                ? "border-success/45 bg-success-soft text-success"
                : verdict === "wrong"
                  ? "border-danger/45 bg-danger-soft text-danger"
                  : verdict === "slow"
                    ? "border-border bg-surface-sunken text-ink-faint"
                    : "border-border bg-surface text-ink"
            }`}
            aria-live="polite"
          >
            {round && verdict !== "slow" ? (
              <>
                <Arrows row={arrowRow(round)} size={44} />
                <span className="sr-only">
                  {verdict
                    ? verdict === "right"
                      ? "Right"
                      : "Not that way"
                    : `Middle arrow — round ${idx + 1} of ${ARROW_ROUNDS}`}
                </span>
              </>
            ) : verdict === "slow" ? (
              <span className="text-[15px] font-semibold">too slow — next one</span>
            ) : (
              <span className="text-[15px] font-semibold text-ink-faint">get ready…</span>
            )}
          </div>

          <div className="mt-6 grid w-full grid-cols-2 gap-3">
            {(["left", "right"] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => answer(dir)}
                aria-label={dir === "left" ? "Middle points left" : "Middle points right"}
                className="grid h-24 place-items-center rounded-3xl border border-border bg-surface text-ink shadow-card transition-all hover:-translate-y-0.5 hover:shadow-float active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
              >
                {dir === "left" ? <ArrowLeft size={34} strokeWidth={2.4} /> : <ArrowRight size={34} strokeWidth={2.4} />}
              </button>
            ))}
          </div>
          <p className="mt-4 hidden text-[12px] font-medium text-ink-faint sm:block">
            ← → keys work too
          </p>
        </div>
      )}

      {stage === "done" && (
        <GameEnd
          headline={`${summary.correct} of ${ARROW_ROUNDS} right`}
          detail={[
            summary.avgMs != null ? `Average answer ${summary.avgMs} ms.` : null,
            summary.decoyCostMs == null
              ? "The decoys never got a clean shot at you."
              : summary.decoyCostMs > 15
                ? `The decoys cost you ${summary.decoyCostMs} ms each — that's your brain filtering noise, right on cue.`
                : "The decoys barely slowed you. That's unusually good filtering.",
          ]
            .filter(Boolean)
            .join(" ")}
          isNewBest={isNewBest}
          onAgain={start}
          onExit={onExit}
        />
      )}
    </GameShell>
  );
}
