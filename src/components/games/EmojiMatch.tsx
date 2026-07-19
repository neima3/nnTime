"use client";

/**
 * Emoji Match — 8 pairs of Kairo's category emoji in a 4×4 grid. Fewest
 * moves is the personal best. Flips are instant under reduced motion.
 */
import { useEffect, useState } from "react";
import { buildMatchDeck, readBest, recordResult } from "@/lib/games";
import { celebrate } from "../Celebration";
import { GameEnd, GameShell } from "./GameShell";

interface Card {
  emoji: string;
  state: "down" | "up" | "matched";
}

export function EmojiMatch({ onExit }: { onExit: () => void }) {
  const [cards, setCards] = useState<Card[]>(() =>
    buildMatchDeck().map((emoji) => ({ emoji, state: "down" as const })),
  );
  const [picked, setPicked] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [locked, setLocked] = useState(false);

  const deal = () => {
    setCards(buildMatchDeck().map((emoji) => ({ emoji, state: "down" })));
    setPicked([]);
    setMoves(0);
    setIsNewBest(false);
    setBest(readBest("emoji-match"));
  };

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setBest(readBest("emoji-match"));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const done = cards.length > 0 && cards.every((c) => c.state === "matched");

  const flip = (i: number) => {
    if (locked || done) return;
    const card = cards[i];
    if (!card || card.state !== "down") return;

    const nextPicked = [...picked, i];
    setCards((prev) => prev.map((c, k) => (k === i ? { ...c, state: "up" } : c)));

    if (nextPicked.length < 2) {
      setPicked(nextPicked);
      return;
    }

    setMoves((m) => m + 1);
    const [a, b] = nextPicked;
    const match = cards[a!]!.emoji === card.emoji;
    if (match) {
      const wasLastPair =
        cards.filter((c) => c.state === "matched").length + 2 === cards.length;
      setCards((prev) =>
        prev.map((c, k) =>
          k === a || k === b ? { ...c, state: "matched" } : c,
        ),
      );
      setPicked([]);
      if (wasLastPair) {
        const finalMoves = moves + 1;
        const newBest = recordResult("emoji-match", finalMoves, "low");
        setIsNewBest(newBest);
        if (newBest)
          celebrate(window.innerWidth / 2, window.innerHeight / 2 - 80);
      }
    } else {
      setLocked(true);
      setPicked([]);
      window.setTimeout(() => {
        setCards((prev) =>
          prev.map((c, k) => (k === a || k === b ? { ...c, state: "down" } : c)),
        );
        setLocked(false);
      }, 750);
    }
  };

  return (
    <GameShell
      title="Emoji Match"
      emoji="🃏"
      howTo="Find the 8 pairs. Fewer flips, better memory day."
      best={best != null ? `${best} moves` : null}
      onExit={onExit}
    >
      {!done ? (
        <div className="rise-in flex flex-col items-center">
          <div className="grid grid-cols-4 gap-2.5">
            {cards.map((c, i) => (
              <button
                key={i}
                type="button"
                aria-label={c.state === "down" ? "Face-down card" : c.emoji}
                onClick={() => flip(i)}
                disabled={c.state !== "down"}
                className={`grid size-16 place-items-center rounded-2xl border text-2xl transition-all sm:size-[4.5rem] ${
                  c.state === "down"
                    ? "border-border bg-iris-soft shadow-card hover:-translate-y-0.5 active:scale-95"
                    : c.state === "matched"
                      ? "border-success/30 bg-success-soft"
                      : "border-iris bg-surface shadow-float"
                }`}
              >
                <span
                  className={c.state === "down" ? "opacity-0" : "opacity-100"}
                  aria-hidden
                >
                  {c.emoji}
                </span>
              </button>
            ))}
          </div>
          <p className="tnum mt-5 text-[13px] font-semibold text-ink-soft">
            {moves} moves
          </p>
        </div>
      ) : (
        <GameEnd
          headline={`All pairs in ${moves} moves`}
          detail={
            moves <= 12
              ? "That's a sharp matching run — the pairs barely stood a chance."
              : "Every flip you remembered was working memory doing its thing."
          }
          isNewBest={isNewBest}
          onAgain={deal}
          onExit={onExit}
        />
      )}
    </GameShell>
  );
}
