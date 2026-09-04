"use client";

/**
 * Brain breaks arcade (wave 9). Fifteen small games in four moods, personal
 * bests only, all client-side. Framed honestly: play that rests the brain —
 * not "training".
 */
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { dailyThree, dailyThreeKey, readBest, type GameId } from "@/lib/games";
import { hasIllustration, Illustration } from "./Illustration";

/* Games load on tap, not with the arcade — the grid stays feather-light
   and each game's chunk (plus the quiz banks) arrives only when chosen. */
const GameLoadingExitContext = createContext<(() => void) | null>(null);

function GameLoading() {
  const onExit = useContext(GameLoadingExitContext);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !onExit) return;
    if (!dialog.open) dialog.showModal();
    cancelRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [onExit]);

  if (!onExit) return null;
  return (
    <dialog
      ref={dialogRef}
      aria-label="Opening game"
      onCancel={(event) => {
        event.preventDefault();
        onExit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Tab") {
          event.preventDefault();
          cancelRef.current?.focus();
        }
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-canvas p-0 text-ink backdrop:bg-canvas/70 open:grid open:place-items-center"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-[14px] font-semibold text-ink-soft">opening…</p>
        <button
          ref={cancelRef}
          type="button"
          aria-label="Cancel opening game"
          onClick={onExit}
          className="rounded-xl border border-border bg-surface px-4 py-2 text-[13px] font-semibold text-ink-soft shadow-card focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
        >
          Back to games
        </button>
      </div>
    </dialog>
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
const ProofIt = dynamic(() => import("./games/ProofIt").then((m) => m.ProofIt), { loading: GameLoading });
const NumberLadder = dynamic(() => import("./games/NumberLadder").then((m) => m.NumberLadder), { loading: GameLoading });
const InOrder = dynamic(() => import("./games/InOrder").then((m) => m.InOrder), { loading: GameLoading });

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
      {
        id: "number-ladder",
        emoji: "🪜",
        title: "Number Ladder",
        hook: "Start small. Climb one sum at a time — no paper allowed.",
        tint: "bg-cat-peach",
        bestLabel: (v) => `best ${v}/6`,
      },
      {
        id: "in-order",
        emoji: "🧭",
        title: "In Order",
        hook: "Five everyday how-tos, steps shuffled. Rebuild them.",
        tint: "bg-cat-lilac",
        bestLabel: (v) => `best ${v}/5 clean`,
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
        hook: "80 classic snags, each with the trick and real examples — it remembers the ones that get you.",
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
      {
        id: "proof-it",
        emoji: "✏️",
        title: "Proof It",
        hook: "One word in each sentence is wrong. Trust your eye.",
        tint: "bg-cat-mint",
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

/**
 * Card art: the game's clay tile (docs/design/illustrations.md) on its tint,
 * with the emoji as the reduced-stimulation stand-in — illustrations are
 * removed in calm mode, and a bare tinted square reads as broken.
 */
function GameArt({
  game,
  size,
  box,
}: {
  game: GameCard;
  size: number;
  box: string;
}) {
  const art = `tile-${game.id}`;
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden ${box} ${game.tint}`}
      aria-hidden
    >
      {hasIllustration(art) ? (
        <>
          <Illustration name={art} size={size} glow="none" className="scale-[1.12]" />
          <span className="hidden [.reduced-stimulation_&]:inline">{game.emoji}</span>
        </>
      ) : (
        game.emoji
      )}
    </span>
  );
}

export function PlayClient() {
  const [active, setActive] = useState<GameId | null>(null);
  const [bests, setBests] = useState<Record<string, number | null>>({});
  // Client-only: hangs on the local date, so it must wait for hydration.
  const [daily, setDaily] = useState<GameId[]>([]);
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
    setDaily(dailyThree(dailyThreeKey()));
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

  let activeGame: ReactNode = null;
  if (active === "time-feel") activeGame = <TimeFeel onExit={exit} />;
  else if (active === "quick-tap") activeGame = <QuickTap onExit={exit} />;
  else if (active === "emoji-match") activeGame = <EmojiMatch onExit={exit} />;
  else if (active === "steady-breath") activeGame = <SteadyBreath onExit={exit} />;
  else if (active === "number-hunt") activeGame = <FocusFinder onExit={exit} />;
  else if (active === "memory-trail") activeGame = <MemoryTrail onExit={exit} />;
  else if (active === "color-clash") activeGame = <ColorClash onExit={exit} />;
  else if (active === "odd-one-out") activeGame = <OddOneOut onExit={exit} />;
  else if (active === "digit-span") activeGame = <DigitSpan onExit={exit} />;
  else if (active === "green-light") activeGame = <GreenLight onExit={exit} />;
  else if (active === "night-sky") activeGame = <NightSky onExit={exit} />;
  else if (active === "letter-soup") activeGame = <LetterSoup onExit={exit} />;
  else if (active === "pattern-tiles") activeGame = <PatternTiles onExit={exit} />;
  else if (active === "grammar-snap") activeGame = <GrammarSnap onExit={exit} />;
  else if (active === "spell-check") activeGame = <SpellCheckGame onExit={exit} />;
  else if (active === "proof-it") activeGame = <ProofIt onExit={exit} />;
  else if (active === "number-ladder") activeGame = <NumberLadder onExit={exit} />;
  else if (active === "in-order") activeGame = <InOrder onExit={exit} />;

  if (activeGame) {
    return (
      <GameLoadingExitContext.Provider value={exit}>
        {activeGame}
      </GameLoadingExitContext.Provider>
    );
  }

  const dailyGames = daily
    .map((id) => ALL_GAMES.find((g) => g.id === id))
    .filter((g): g is GameCard => g != null);

  return (
    <div className="flex flex-col gap-9">
      {dailyGames.length === 3 && (
        <section aria-label="Today's three">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <h2 className="whitespace-nowrap text-[12.5px] font-bold uppercase tracking-[0.14em] text-iris">
              Today&apos;s three
            </h2>
            <p className="text-[12.5px] text-ink-faint">
              Picked for today — no choosing required.
            </p>
          </div>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
            {dailyGames.map((g) => (
              <button
                key={`daily-${g.id}`}
                type="button"
                onClick={() => openGame(g.id)}
                className="rise-in group flex items-center gap-3 rounded-2xl border border-iris/25 bg-surface px-4 py-3 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-float active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
              >
                <GameArt game={g} size={36} box="size-9 rounded-xl text-lg" />
                <span className="min-w-0">
                  <span className="block truncate font-display text-[15px] font-bold">
                    {g.title}
                  </span>
                  <span className="block text-[11.5px] font-bold text-iris opacity-0 transition-opacity group-hover:opacity-100">
                    Play →
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      {SECTIONS.map((section) => (
        <section key={section.label}>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <h2 className="whitespace-nowrap text-[12.5px] font-bold uppercase tracking-[0.14em] text-ink-faint">
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
                    <GameArt game={g} size={54} box="size-14 rounded-2xl text-2xl" />
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
