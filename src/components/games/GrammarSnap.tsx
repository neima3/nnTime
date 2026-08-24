"use client";

/**
 * Grammar Snap, self-contained: carries its bank and end-copy so the
 * arcade can lazy-load the whole quiz (engine + 80-item bank) on tap.
 */
import { GRAMMAR_BANK } from "@/lib/games";
import { QuizGame } from "./QuizGame";

export function GrammarSnap({ onExit }: { onExit: () => void }) {
  return (
    <QuizGame
      id="grammar-snap"
      title="Grammar Snap"
      emoji="📝"
      howTo="Tap the word that fits. No red pens here."
      bank={GRAMMAR_BANK}
      endDetail={(score) =>
        score >= 7
          ? "Basically an editor. English fears you."
          : score >= 4
            ? "Solid — and every miss came with a memory hook."
            : "These pairs trip up native speakers daily. Now you know their tricks."
      }
      onExit={onExit}
    />
  );
}
