"use client";

/**
 * Brain breaks arcade (wave 9). Fifteen small games in four moods, personal
 * bests only, all client-side. Framed honestly: play that rests the brain —
 * not "training".
 */
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { readBest, type GameId } from "@/lib/games";

/* Games load on tap, not with the arcade — the grid stays feather-light
   and each game's chunk (plus the quiz banks) arrives only when chosen. */
function GameLoading() {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-canvas">
      <p className="text-[14px] font-semibold text-ink-soft">opening…</p>
    </div>
  );
}
const TimeFeel = dynamic(() => import("./games/TimeFeel").then((m) => m.TimeFeel), { loading: GameLoading });
const QuickTap = dynamic(() => import("./games/QuickTap").then((m) => m.QuickTap), { loading: GameLoading });
const EmojiMatch = dynamic(() => import("./games/EmojiMatch").then((m) => m.EmojiMatch), { loading: GameLoading });
const SteadyBreath = dynamic(() => import("./games/SteadyBreath").then((m) => m.SteadyBreath), { loading: GameLoading });
const FocusFinder = dynamic(() => import("./games/FocusFinder").then((m) => m.FocusFinder), { loading: GameLoading });
const MemoryTrail = dynamic(() => import("./games/MemoryTrail").then((m) => m.MemoryTrail), { loading: GameLoading });
const ColorClash = dynamic(() => import("./games/ColorClash").then((m) => m.ColorClash), { loading: GameLoading });
const OddOneOut = dynamic(() => import("./games/OddOneOut").then((m) => m.OddOneOut), { loading: GameLoading });
const DigitSpan = dynamic(() => import("./games/DigitSpan").then((m) => m.DigitSpan), { loading: GameLoading });
const GreenLight = dynamic(() => import("./games/GreenLight").then((m) => m.GreenLight), { loading: GameLoading });
const NightSky = dynamic(() => import("./games/NightSky").then((m) => m.NightSky), { loading: GameLoading });
const LetterSoup = dynamic(() => import("./games/LetterSoup").then((m) => m.LetterSoup), { loading: GameLoading });
const PatternTiles = dynamic(() => import("./games/PatternTiles").then((m) => m.PatternTiles), { loading: GameLoading });
const GrammarSnap = dynamic(() => import("./games/GrammarSnap").then((m) => m.GrammarSnap), { loading: GameLoading });
const SpellCheckGame = dynamic(() => import("./games/SpellCheckGame").then((m) => m.SpellCheckGame), { loading: GameLoading });

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
      {
        id: "green-light",
        emoji: "🚦",
        title: "Green Light",
        hook: "Green means tap. Red means don't. Simple. Ha.",
        tint: "bg-cat-mint",
        bestLabel: (v) => `best ${v}/24`,
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
      {
        id: "pattern-tiles",
        emoji: "🧩",
        title: "Pattern Tiles",
        hook: "A few tiles flash together. Hold the shape.",
        tint: "bg-cat-sky",
        bestLabel: (v) => `best pattern ${v}`,
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
      {
        id: "letter-soup",
        emoji: "🍲",
        title: "Letter Soup",
        hook: "Everyday words, gently scrambled.",
        tint: "bg-cat-butter",
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
      {
        id: "night-sky",
        emoji: "🌌",
        title: "Night Sky",
        hook: "Connect the stars. Nothing is timed.",
        tint: "bg-cat-lilac",
        bestLabel: (v) => `${v} skies traced`,
      },
    ],
  },
];

const ALL_GAMES = SECTIONS.flatMap((s) => s.games);

export function PlayClient() {
  const [active, setActive] = useState<GameId | null>(null);
  const [bests, setBests] = useState<Record<string, number | null>>({});
  const openerId = useRef<GameId | null>(null);
  const gameButtons = useRef<
    Partial<Record<GameId, HTMLButtonElement | null>>
  >({});

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

  useEffect(() => {
    if (active !== null || openerId.current === null) return;
    const id = openerId.current;
    const frame = requestAnimationFrame(() => {
      gameButtons.current[id]?.focus();
      openerId.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);

  const openGame = (id: GameId) => {
    openerId.current = id;
    setActive(id);
  };

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
  if (active === "green-light") return <GreenLight onExit={exit} />;
  if (active === "night-sky") return <NightSky onExit={exit} />;
  if (active === "letter-soup") return <LetterSoup onExit={exit} />;
  if (active === "pattern-tiles") return <PatternTiles onExit={exit} />;
  if (active === "grammar-snap") return <GrammarSnap onExit={exit} />;
  if (active === "spell-check") return <SpellCheckGame onExit={exit} />;

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
                  ref={(button) => {
                    gameButtons.current[g.id] = button;
                  }}
                  type="button"
                  onClick={() => openGame(g.id)}
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
