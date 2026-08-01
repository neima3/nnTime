"use client";

/**
 * Spell Check, self-contained: carries its bank and end-copy so the
 * arcade can lazy-load the whole quiz on tap.
 */
import { SPELLING_BANK } from "@/lib/games";
import { QuizGame } from "./QuizGame";

export function SpellCheckGame({ onExit }: { onExit: () => void }) {
  return (
    <QuizGame
      id="spell-check"
      title="Spell Check"
      emoji="🔤"
      howTo="Tap the real spelling among the impostors."
      bank={SPELLING_BANK}
      endDetail={(score) =>
        score >= 7
          ? "Spelling bee champion energy."
          : score >= 4
            ? "Good eye — the impostors are convincing on purpose."
            : "These are the most-misspelled words in English. You're in excellent company."
      }
      onExit={onExit}
    />
  );
}
