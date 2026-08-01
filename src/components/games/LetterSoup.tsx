"use client";

/**
 * Letter Soup — everyday words, gently scrambled. Tap letters into place;
 * a wrong build shakes out kindly, and "show me" always exists without
 * shame. Solved words out of eight is the personal best.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  pickSoupWords,
  readBest,
  recordResult,
  scrambleWord,
  SOUP_ROUNDS,
} from "@/lib/games";
import { celebrate } from "../Celebration";
import { GameEnd, GameShell } from "./GameShell";

type Stage = "intro" | "playing" | "done";

interface Tile {
  letter: string;
  used: boolean;
}

export function LetterSoup({ onExit }: { onExit: () => void }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [words, setWords] = useState<string[]>([]);
  const [roundNo, setRoundNo] = useState(0);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [built, setBuilt] = useState<number[]>([]);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [solved, setSolved] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setBest(readBest("letter-soup"));
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const dealRound = useCallback((word: string) => {
    setTiles(scrambleWord(word).map((letter) => ({ letter, used: false })));
    setBuilt([]);
    setWrongFlash(false);
    setRevealed(false);
  }, []);

  const start = useCallback(() => {
    const drawn = pickSoupWords();
    setWords(drawn);
    setRoundNo(0);
    setSolved(0);
    setIsNewBest(false);
    setBest(readBest("letter-soup"));
    dealRound(drawn[0]!);
    setStage("playing");
  }, [dealRound]);

  const word = words[roundNo] ?? "";

  const finishRound = useCallback(
    (didSolve: boolean) => {
      const nextSolved = solved + (didSolve ? 1 : 0);
      setSolved(nextSolved);
      const nextRound = roundNo + 1;
      timerRef.current = window.setTimeout(() => {
        if (nextRound >= words.length) {
          const newBest = recordResult("letter-soup", nextSolved, "high");
          setIsNewBest(newBest);
          if (newBest)
            celebrate(window.innerWidth / 2, window.innerHeight / 2 - 80);
          setStage("done");
          return;
        }
        setRoundNo(nextRound);
        dealRound(words[nextRound]!);
      }, didSolve ? 650 : 1400);
    },
    [solved, roundNo, words, dealRound],
  );

  const tapTile = useCallback(
    (idx: number) => {
      if (stage !== "playing" || revealed || wrongFlash) return;
      const tile = tiles[idx];
      if (!tile || tile.used) return;
      const nextBuilt = [...built, idx];
      setTiles((prev) =>
        prev.map((t, i) => (i === idx ? { ...t, used: true } : t)),
      );
      setBuilt(nextBuilt);
      if (nextBuilt.length === tiles.length) {
        const attempt = nextBuilt.map((i) => tiles[i]!.letter).join("");
        if (attempt === word) {
          finishRound(true);
        } else {
          // Kind reset: flash, then hand the letters back.
          setWrongFlash(true);
          timerRef.current = window.setTimeout(() => {
            setTiles((prev) => prev.map((t) => ({ ...t, used: false })));
            setBuilt([]);
            setWrongFlash(false);
          }, 650);
        }
      }
    },
    [stage, revealed, wrongFlash, tiles, built, word, finishRound],
  );

  const undoLast = useCallback(() => {
    if (stage !== "playing" || built.length === 0 || wrongFlash) return;
    const last = built[built.length - 1]!;
    setTiles((prev) =>
      prev.map((t, i) => (i === last ? { ...t, used: false } : t)),
    );
    setBuilt((b) => b.slice(0, -1));
  }, [stage, built, wrongFlash]);

  const reveal = useCallback(() => {
    if (stage !== "playing" || revealed) return;
    setRevealed(true);
    setBuilt([]);
    finishRound(false);
  }, [stage, revealed, finishRound]);

  return (
    <GameShell
      title="Letter Soup"
      emoji="🍲"
      howTo="Everyday words, gently scrambled. Tap the letters into place."
      best={best != null ? `${best}/${SOUP_ROUNDS}` : null}
      onExit={onExit}
    >
      {stage === "intro" && (
        <div className="rise-in flex flex-col items-center text-center">
          <p className="max-w-xs text-[14.5px] text-ink-soft">
            Eight familiar words hiding in their own letters. Build each one
            back — and &ldquo;show me&rdquo; is always there, no shame attached.
          </p>
          <button
            type="button"
            onClick={start}
            className="mt-7 rounded-2xl bg-iris px-8 py-3.5 text-[15px] font-semibold text-ink-inverse shadow-float transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
          >
            Stir the soup
          </button>
        </div>
      )}

      {stage === "playing" && (
        <div className="rise-in flex w-full max-w-sm flex-col items-center">
          <p className="tnum mb-5 text-[13px] font-semibold text-ink-soft">
            word {roundNo + 1} of {words.length} · {solved} solved
          </p>

          <div
            className={`flex min-h-14 items-center gap-1.5 rounded-2xl border px-3 py-2 transition-colors ${
              wrongFlash
                ? "border-danger/50 bg-danger-soft"
                : revealed
                  ? "border-success/40 bg-success-soft"
                  : "border-border bg-surface-sunken"
            }`}
            aria-live="polite"
            aria-label={revealed ? `The word was ${word}` : "Your letters so far"}
          >
            {revealed
              ? word.split("").map((letter, i) => (
                  <span key={i} className="font-display text-2xl font-bold uppercase">
                    {letter}
                  </span>
                ))
              : Array.from({ length: word.length }, (_, i) => (
                  <span
                    key={i}
                    className="grid size-9 place-items-center rounded-xl border border-border bg-surface font-display text-xl font-bold uppercase"
                  >
                    {built[i] != null ? tiles[built[i]!]!.letter : ""}
                  </span>
                ))}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {tiles.map((tile, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => tapTile(idx)}
                disabled={tile.used || revealed}
                aria-label={`Letter ${tile.letter.toUpperCase()}${tile.used ? ", placed" : ""}`}
                className={`grid size-12 place-items-center rounded-2xl border font-display text-xl font-bold uppercase shadow-card transition-all ${
                  tile.used
                    ? "border-border bg-surface-sunken text-ink-faint opacity-40"
                    : "border-border bg-surface text-ink hover:-translate-y-0.5 active:scale-95"
                } focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none`}
              >
                {tile.letter}
              </button>
            ))}
          </div>

          <div className="mt-6 flex gap-2.5">
            <button
              type="button"
              onClick={undoLast}
              disabled={built.length === 0 || revealed}
              className="rounded-2xl border border-border bg-surface px-4 py-2.5 text-[13.5px] font-semibold text-ink-soft shadow-card transition-colors hover:text-ink disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
            >
              ⌫ Take one back
            </button>
            <button
              type="button"
              onClick={reveal}
              disabled={revealed}
              className="rounded-2xl border border-border bg-surface px-4 py-2.5 text-[13.5px] font-semibold text-ink-soft shadow-card transition-colors hover:text-ink disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
            >
              Show me
            </button>
          </div>
        </div>
      )}

      {stage === "done" && (
        <GameEnd
          headline={`${solved} of ${SOUP_ROUNDS} unscrambled`}
          detail={
            solved >= 7
              ? "The alphabet works for you now. Barely a scramble at all."
              : solved >= 4
                ? "Solid soup work — reassembling words is real pattern-matching."
                : "Scrambles are sneakier than they look. The words don't mind another visit."
          }
          isNewBest={isNewBest}
          onAgain={start}
          onExit={onExit}
        />
      )}
    </GameShell>
  );
}
