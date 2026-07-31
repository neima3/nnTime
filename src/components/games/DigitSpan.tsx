"use client";

/**
 * Digit Span — the classic working-memory stretch. Digits flash, then you
 * tap them back on a keypad. Each clean recall adds one digit; the longest
 * span is the personal best.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  makeSpan,
  readBest,
  recordResult,
  SPAN_START,
  spanShowMs,
} from "@/lib/games";
import { celebrate } from "../Celebration";
import { GameEnd, GameShell } from "./GameShell";

type Stage = "intro" | "showing" | "typing" | "done";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;

export function DigitSpan({ onExit }: { onExit: () => void }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [span, setSpan] = useState("");
  const [entered, setEntered] = useState("");
  const [completedLen, setCompletedLen] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setBest(readBest("digit-span"));
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const show = useCallback((len: number) => {
    const next = makeSpan(len);
    setSpan(next);
    setEntered("");
    setStage("showing");
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(
      () => setStage("typing"),
      spanShowMs(len),
    );
  }, []);

  const start = useCallback(() => {
    setCompletedLen(0);
    setIsNewBest(false);
    setBest(readBest("digit-span"));
    show(SPAN_START);
  }, [show]);

  const finish = useCallback(
    (len: number) => {
      if (len > 0) {
        const newBest = recordResult("digit-span", len, "high");
        setIsNewBest(newBest);
        if (newBest)
          celebrate(window.innerWidth / 2, window.innerHeight / 2 - 80);
      }
      setStage("done");
    },
    [],
  );

  const press = useCallback(
    (key: string) => {
      if (stage !== "typing") return;
      const next = entered + key;
      setEntered(next);
      if (next.length < span.length) return;
      if (next === span) {
        setCompletedLen(span.length);
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(
          () => show(span.length + 1),
          550,
        );
      } else {
        finish(completedLen);
      }
    },
    [stage, entered, span, completedLen, show, finish],
  );

  const erase = useCallback(() => {
    if (stage !== "typing") return;
    setEntered((e) => e.slice(0, -1));
  }, [stage]);

  // Physical keyboard plays too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") erase();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, erase]);

  const recalled = entered === span.slice(0, entered.length);

  return (
    <GameShell
      title="Digit Span"
      emoji="🔢"
      howTo="Numbers flash, then it's all you. Tap them back in order."
      best={best != null ? `span ${best}` : null}
      onExit={onExit}
    >
      {stage === "intro" && (
        <div className="rise-in flex flex-col items-center text-center">
          <p className="max-w-xs text-[14.5px] text-ink-soft">
            Three digits to start. Hold them for a breath, tap them back, and
            the span grows by one. How long is your line?
          </p>
          <button
            type="button"
            onClick={start}
            className="mt-7 rounded-2xl bg-iris px-8 py-3.5 text-[15px] font-semibold text-ink-inverse shadow-float transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
          >
            Flash the digits
          </button>
        </div>
      )}

      {stage === "showing" && (
        <div className="rise-in flex flex-col items-center">
          <p className="mb-5 rounded-xl bg-surface-sunken px-3 py-1.5 text-[13px] font-bold text-ink-soft">
            memorize — {span.length} digits
          </p>
          <p className="tnum font-display text-6xl font-bold tracking-[0.18em]">
            {span}
          </p>
        </div>
      )}

      {stage === "typing" && (
        <div className="rise-in flex flex-col items-center">
          <p className="mb-4 rounded-xl bg-iris-ghost px-3 py-1.5 text-[13px] font-bold text-iris">
            your turn — {entered.length} of {span.length}
          </p>
          <p
            className={`tnum mb-6 h-12 font-display text-4xl font-bold tracking-[0.2em] ${
              recalled ? "text-ink" : "text-danger"
            }`}
            aria-live="polite"
          >
            {entered || "·"}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {KEYS.slice(0, 9).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                className="tnum grid size-16 place-items-center rounded-2xl border border-border bg-surface font-display text-xl font-bold shadow-card transition-all hover:-translate-y-0.5 active:scale-95 focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
              >
                {key}
              </button>
            ))}
            <button
              type="button"
              onClick={erase}
              aria-label="Delete last digit"
              className="grid size-16 place-items-center rounded-2xl border border-border bg-surface-sunken text-[14px] font-bold text-ink-soft shadow-card transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
            >
              ⌫
            </button>
            <button
              type="button"
              onClick={() => press("0")}
              className="tnum grid size-16 place-items-center rounded-2xl border border-border bg-surface font-display text-xl font-bold shadow-card transition-all hover:-translate-y-0.5 active:scale-95 focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
            >
              0
            </button>
          </div>
        </div>
      )}

      {stage === "done" && (
        <GameEnd
          headline={
            completedLen > 0 ? `Span of ${completedLen}` : "The digits got away"
          }
          detail={
            completedLen >= 7
              ? "Seven-plus is phone-number territory — working memory in top form."
              : completedLen > 0
                ? "Every digit you held was your brain juggling in real time."
                : "Three digits vanish fast. One more flash and they're yours."
          }
          isNewBest={isNewBest}
          onAgain={start}
          onExit={onExit}
        />
      )}
    </GameShell>
  );
}
