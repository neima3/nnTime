"use client";

/**
 * Brain breaks arcade (wave 5). Eleven small games in four moods, personal
 * bests only, all client-side. Framed honestly: play that rests the brain —
 * not "training".
 */
import { useEffect, useState } from "react";
import { readBest, type GameId } from "@/lib/games";
import { TimeFeel } from "./games/TimeFeel";
import { QuizGame } from "./games/QuizGame";
import { GRAMMAR_BANK, SPELLING_BANK } from "@/lib/games";
import { QuickTap } from "./games/QuickTap";
import { EmojiMatch } from "./games/EmojiMatch";
import { SteadyBreath } from "./games/SteadyBreath";
import { FocusFinder } from "./games/FocusFinder";
import { MemoryTrail } from "./games/MemoryTrail";
import { ColorClash } from "./games/ColorClash";
import { OddOneOut } from "./games/OddOneOut";
import { DigitSpan } from "./games/DigitSpan";

interface GameCard {
  id: GameId;
  emoji: string;
  title: string;
  hook: string;
  tint: string;
  bestLabel: (v: number) => string;
}

const SECTIONS: { label: string; blurb: string; games: GameCard[] }[] = [
  {
    label: "Sharp & fast",
    blurb: "Eyes and reflexes on sprint duty.",
    games: [
      {
        id: "quick-tap",
        emoji: "⚡",
        title: "Quick Tap",
        hook: "Purple means go. How fast are you today?",
        tint: "bg-cat-butter",
        bestLabel: (v) => `best ${v} ms`,
      },
      {
        id: "number-hunt",
        emoji: "🔍",
        title: "Focus Finder",
        hook: "1 to 25, hiding in plain sight. Eyes on sprint duty.",
        tint: "bg-cat-sky",
        bestLabel: (v) => `best ${v}s`,
      },
      {
        id: "odd-one-out",
        emoji: "🕵️",
        title: "Odd One Out",
        hook: "One of these is not like the others.",
        tint: "bg-cat-butter",
        bestLabel: (v) => `best ${v}s`,
      },
      {
        id: "color-clash",
        emoji: "🎨",
        title: "Color Clash",
        hook: "Tap what you see, not what you read.",
        tint: "bg-cat-rose",
        bestLabel: (v) => `best ${v}/12`,
      },
    ],
  },
  {
    label: "Hold it in mind",
    blurb: "Working memory, lifting gently.",
    games: [
      {
        id: "emoji-match",
        emoji: "🃏",
        title: "Emoji Match",
        hook: "Eight pairs hiding in sixteen cards.",
        tint: "bg-cat-peach",
        bestLabel: (v) => `best ${v} moves`,
      },
      {
        id: "memory-trail",
        emoji: "🐾",
        title: "Memory Trail",
        hook: "Watch the path glow, then walk it back.",
        tint: "bg-cat-lilac",
        bestLabel: (v) => `best trail ${v}`,
      },
      {
        id: "digit-span",
        emoji: "🔢",
        title: "Digit Span",
        hook: "Numbers flash, then it's all you.",
        tint: "bg-cat-peach",
        bestLabel: (v) => `best span ${v}`,
      },
    ],
  },
  {
    label: "Wordplay",
    blurb: "Snags and spellings, zero red pens.",
    games: [
      {
        id: "grammar-snap",
        emoji: "📝",
        title: "Grammar Snap",
        hook: "60+ classic snags across ten topics — it remembers the ones that get you.",
        tint: "bg-cat-sky",
        bestLabel: (v) => `best ${v}/8`,
      },
      {
        id: "spell-check",
        emoji: "🔤",
        title: "Spell Check",
        hook: "Definitely? Definately? One of these is real.",
        tint: "bg-cat-rose",
        bestLabel: (v) => `best ${v}/8`,
      },
    ],
  },
  {
    label: "Slow down",
    blurb: "For spinning heads and racing clocks.",
    games: [
      {
        id: "time-feel",
        emoji: "⏳",
        title: "Time Feel",
        hook: "Your brain vs. the clock — no peeking.",
        tint: "bg-cat-lilac",
        bestLabel: (v) => `best ${v}/100`,
      },
      {
        id: "steady-breath",
        emoji: "🫧",
        title: "Steady Breath",
        hook: "A square minute for a spinning head.",
        tint: "bg-cat-mint",
        bestLabel: (v) => `${v} cycles breathed`,
      },
    ],
  },
];

const ALL_GAMES = SECTIONS.flatMap((s) => s.games);

export function PlayClient() {
  const [active, setActive] = useState<GameId | null>(null);
  const [bests, setBests] = useState<Record<string, number | null>>({});

  const refreshBests = () => {
    const next: Record<string, number | null> = {};
    for (const g of ALL_GAMES) next[g.id] = readBest(g.id);
    setBests(next);
  };

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    refreshBests();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const exit = () => {
    setActive(null);
    refreshBests();
  };

  if (active === "time-feel") return <TimeFeel onExit={exit} />;
  if (active === "quick-tap") return <QuickTap onExit={exit} />;
  if (active === "emoji-match") return <EmojiMatch onExit={exit} />;
  if (active === "steady-breath") return <SteadyBreath onExit={exit} />;
  if (active === "number-hunt") return <FocusFinder onExit={exit} />;
  if (active === "memory-trail") return <MemoryTrail onExit={exit} />;
  if (active === "color-clash") return <ColorClash onExit={exit} />;
  if (active === "odd-one-out") return <OddOneOut onExit={exit} />;
  if (active === "digit-span") return <DigitSpan onExit={exit} />;
  if (active === "grammar-snap")
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
        onExit={exit}
      />
    );
  if (active === "spell-check")
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
        onExit={exit}
      />
    );

  return (
    <div className="flex flex-col gap-9">
      {SECTIONS.map((section) => (
        <section key={section.label}>
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-ink-faint">
              {section.label}
            </h2>
            <p className="text-[12.5px] text-ink-faint">{section.blurb}</p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {section.games.map((g) => {
              const best = bests[g.id];
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setActive(g.id)}
                  className="rise-in group rounded-3xl border border-border bg-surface p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-float active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={`grid size-12 place-items-center rounded-2xl text-2xl ${g.tint}`}
                      aria-hidden
                    >
                      {g.emoji}
                    </span>
                    {best != null && (
                      <span className="tnum rounded-lg bg-surface-sunken px-2 py-1 text-[11px] font-bold text-ink-soft">
                        {g.bestLabel(best)}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3.5 font-display text-lg font-bold">
                    {g.title}
                  </h3>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">
                    {g.hook}
                  </p>
                  <p className="mt-3 text-[12.5px] font-bold text-iris opacity-0 transition-opacity group-hover:opacity-100">
                    Play →
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
