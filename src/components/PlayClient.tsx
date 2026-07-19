"use client";

/**
 * Brain breaks arcade (wave 3). Four small games, personal bests only, all
 * client-side. Framed honestly: play that rests the brain — not "training".
 */
import { useEffect, useState } from "react";
import { readBest, type GameId } from "@/lib/games";
import { TimeFeel } from "./games/TimeFeel";
import { QuickTap } from "./games/QuickTap";
import { EmojiMatch } from "./games/EmojiMatch";
import { SteadyBreath } from "./games/SteadyBreath";

const GAMES: {
  id: GameId;
  emoji: string;
  title: string;
  hook: string;
  tint: string;
  bestLabel: (v: number) => string;
}[] = [
  {
    id: "time-feel",
    emoji: "⏳",
    title: "Time Feel",
    hook: "Your brain vs. the clock — no peeking.",
    tint: "bg-cat-lilac",
    bestLabel: (v) => `best ${v}/100`,
  },
  {
    id: "quick-tap",
    emoji: "⚡",
    title: "Quick Tap",
    hook: "Purple means go. How fast are you today?",
    tint: "bg-cat-butter",
    bestLabel: (v) => `best ${v} ms`,
  },
  {
    id: "emoji-match",
    emoji: "🃏",
    title: "Emoji Match",
    hook: "Eight pairs hiding in sixteen cards.",
    tint: "bg-cat-peach",
    bestLabel: (v) => `best ${v} moves`,
  },
  {
    id: "steady-breath",
    emoji: "🫧",
    title: "Steady Breath",
    hook: "A square minute for a spinning head.",
    tint: "bg-cat-mint",
    bestLabel: (v) => `${v} cycles breathed`,
  },
];

export function PlayClient() {
  const [active, setActive] = useState<GameId | null>(null);
  const [bests, setBests] = useState<Record<string, number | null>>({});

  const refreshBests = () => {
    const next: Record<string, number | null> = {};
    for (const g of GAMES) next[g.id] = readBest(g.id);
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

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {GAMES.map((g) => {
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
            <h3 className="mt-3.5 font-display text-lg font-bold">{g.title}</h3>
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
  );
}
