/**
 * Brain-break game logic (wave 3) — pure, client-safe, unit-testable.
 * Games are honest fun, not "brain training"; scores are personal bests in
 * localStorage only.
 */

/* ---- Time Feel (time reproduction) -------------------------------------- */

export const TIME_FEEL_ROUNDS = [5, 8, 12, 20] as const;

/** Absolute error percentage for one round (0 = perfect). */
export function timeFeelRoundError(targetSec: number, actualSec: number): number {
  if (targetSec <= 0) return 0;
  return Math.abs(actualSec - targetSec) / targetSec;
}

/**
 * Final Time Feel score: 100 − mean absolute error% (floored at 0),
 * rounded — "how close your inner clock runs".
 */
export function timeFeelScore(rounds: { targetSec: number; actualSec: number }[]): number {
  if (rounds.length === 0) return 0;
  const meanErr =
    rounds.reduce((s, r) => s + timeFeelRoundError(r.targetSec, r.actualSec), 0) /
    rounds.length;
  return Math.max(0, Math.round(100 * (1 - meanErr)));
}

/** Kind per-round feedback: fast brain / slow brain / spot on. */
export function timeFeelFeeling(targetSec: number, actualSec: number): "fast" | "slow" | "spot-on" {
  const err = (actualSec - targetSec) / targetSec;
  if (Math.abs(err) <= 0.08) return "spot-on";
  return err < 0 ? "fast" : "slow";
}

/* ---- Quick Tap (reaction) ----------------------------------------------- */

export const QUICK_TAP_ROUNDS = 5;

/** Average of valid reaction times; null if no valid rounds. */
export function quickTapAverage(ms: (number | null)[]): number | null {
  const valid = ms.filter((m): m is number => m != null && m > 0);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

/** Random wait before the go-signal (1.2–3.5 s), from a [0,1) roll. */
export function quickTapDelayMs(roll: number): number {
  return Math.round(1200 + roll * 2300);
}

/* ---- Emoji Match (pairs) ------------------------------------------------- */

export const MATCH_EMOJI = ["🌤", "🎨", "🍜", "🏋️", "📚", "🧘", "☕", "🌙"] as const;

/** Build a shuffled 16-card deck of 8 pairs from a seeded RNG in [0,1). */
export function buildMatchDeck(random: () => number = Math.random): string[] {
  const deck = [...MATCH_EMOJI, ...MATCH_EMOJI] as string[];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}

/* ---- Word quizzes (Grammar Snap + Spell Check) --------------------------- */

export interface QuizItem {
  /** Sentence with ___ for grammar; plain "Which is spelled right?" for spelling. */
  prompt: string;
  options: string[];
  answer: string;
  /** One kind line shown after answering (never shaming). */
  note: string;
}

export const QUIZ_ROUNDS = 8;

/**
 * Grammar Snap bank — the sneaky homophones and near-twins that trip
 * everyone up. Tone: playful, zero red-pen energy.
 */
export const GRAMMAR_BANK: QuizItem[] = [
  { prompt: "___ going to love this timeline.", options: ["Your", "You're"], answer: "You're", note: "You're = you are. Your = it belongs to you." },
  { prompt: "The cat licked ___ paw and judged us all.", options: ["its", "it's"], answer: "its", note: "It's = it is. The cat owns the paw, so: its." },
  { prompt: "___ meeting starts in five minutes.", options: ["They're", "Their", "There"], answer: "Their", note: "Their = belongs to them. There = a place. They're = they are." },
  { prompt: "We planned more breaks ___ we actually took.", options: ["then", "than"], answer: "than", note: "Than compares. Then is about time." },
  { prompt: "Coffee has a strong ___ on my morning plans.", options: ["affect", "effect"], answer: "effect", note: "Effect is (usually) the noun; affect is the verb." },
  { prompt: "___ turn is it to water the plant?", options: ["Whose", "Who's"], answer: "Whose", note: "Who's = who is. Whose owns things." },
  { prompt: "Don't ___ your keys again — put them in the bowl.", options: ["loose", "lose"], answer: "lose", note: "Lose = misplace. Loose = not tight. One o of difference." },
  { prompt: "I'm ___ tired to argue about semicolons.", options: ["to", "too", "two"], answer: "too", note: "Too = also / excessively. To = direction. Two = 2." },
  { prompt: "The plan ___ fine until lunch happened.", options: ["was", "were"], answer: "was", note: "One plan → was. Plural things → were." },
  { prompt: "She did ___ on the exam than she expected.", options: ["better", "more better"], answer: "better", note: "Better is already the comparison — it flies solo." },
  { prompt: "Neither of the timers ___ set.", options: ["was", "were"], answer: "was", note: "Neither is singular at heart — neither one was set." },
  { prompt: "Between you and ___, this app gets me.", options: ["me", "I"], answer: "me", note: "After a preposition (between), it's me. Fancy ≠ correct." },
  { prompt: "The team finished ___ project early.", options: ["there", "their", "they're"], answer: "their", note: "The team owns the project: their." },
  { prompt: "I ___ have gone to bed earlier.", options: ["should of", "should have"], answer: "should have", note: "\"Should of\" is \"should've\" playing dress-up. It's should have." },
  { prompt: "___ a nap change everything? Absolutely.", options: ["Can", "May"], answer: "Can", note: "Can = ability. May = permission. Naps need no permission." },
  { prompt: "The snacks are for ___ finishes their review.", options: ["whoever", "whomever"], answer: "whoever", note: "Whoever does the finishing — subjects get whoever." },
];

/** Spell Check bank — famously slippery words, one true spelling each. */
export const SPELLING_BANK: QuizItem[] = [
  { prompt: "It will ___ happen. Probably today.", options: ["definitely", "definately", "definitly"], answer: "definitely", note: "Finite lives inside definitely." },
  { prompt: "Let's keep work and rest ___.", options: ["seperate", "separate", "seperete"], answer: "separate", note: "There's a rat in separate." },
  { prompt: "Did you ___ my message?", options: ["recieve", "receive", "receeve"], answer: "receive", note: "I before E… except after C — this is the exception's home." },
  { prompt: "Rest is ___, not optional.", options: ["necessary", "neccessary", "necesary"], answer: "necessary", note: "One collar (c), two sleeves (s)." },
  { prompt: "The hotel can ___ late arrivals.", options: ["accomodate", "accommodate", "acommodate"], answer: "accommodate", note: "Accommodate is roomy: two c's AND two m's." },
  { prompt: "Don't let one typo ___ you.", options: ["embarass", "embarrass", "embaress"], answer: "embarrass", note: "Two r's, two s's — fully flustered." },
  { prompt: "Deep focus is a rare ___.", options: ["occurence", "occurrence", "occurance"], answer: "occurrence", note: "Double c, double r — it happens a lot in this word." },
  { prompt: "Drums keep the ___ steady.", options: ["rythm", "rhythm", "rhythem"], answer: "rhythm", note: "Rhythm Helps Your Two Hips Move." },
  { prompt: "Sleep is a ___, guard it.", options: ["privilege", "priviledge", "privelege"], answer: "privilege", note: "No d — privilege travels light." },
  { prompt: "Check the ___ before promising anything.", options: ["calender", "calendar", "calandar"], answer: "calendar", note: "It ends like \"radar\": -ar." },
  { prompt: "That dream was genuinely ___.", options: ["wierd", "weird", "weerd"], answer: "weird", note: "Weird is weird — it breaks the i-before-e rule on purpose." },
  { prompt: "New week, new ___ to try again.", options: ["oppurtunity", "opportunity", "opportunaty"], answer: "opportunity", note: "Two p's up front, like a running start." },
  { prompt: "Small steps, big ___.", options: ["achievment", "achievement", "acheivement"], answer: "achievement", note: "Achieve keeps its e before -ment." },
  { prompt: "Trust the ___ of your routine.", options: ["maintenence", "maintenance", "maintainance"], answer: "maintenance", note: "Main + ten + ance. The ten is the tricky bit." },
  { prompt: "A quiet morning is my favorite ___.", options: ["enviroment", "environment", "enviornment"], answer: "environment", note: "There's iron in environment." },
  { prompt: "We started at the ___.", options: ["begining", "beginning", "beggining"], answer: "beginning", note: "Begin doubles its n when it keeps going." },
];

/**
 * Pick N quiz rounds: seeded shuffle of the bank, then per-item option
 * shuffle so the answer position varies. Returns new arrays (bank untouched).
 */
export function pickQuizRounds(
  bank: QuizItem[],
  n: number = QUIZ_ROUNDS,
  random: () => number = Math.random,
): QuizItem[] {
  const idx = bank.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx.slice(0, Math.min(n, bank.length)).map((i) => {
    const item = bank[i]!;
    const opts = [...item.options];
    for (let k = opts.length - 1; k > 0; k--) {
      const j = Math.floor(random() * (k + 1));
      [opts[k], opts[j]] = [opts[j]!, opts[k]!];
    }
    return { ...item, options: opts };
  });
}

/* ---- localStorage bests -------------------------------------------------- */

export type GameId =
  | "time-feel"
  | "quick-tap"
  | "emoji-match"
  | "steady-breath"
  | "grammar-snap"
  | "spell-check";

const KEY = (id: GameId) => `kairo-play-best-${id}`;

/** Read a stored best (number) or null. */
export function readBest(id: GameId): number | null {
  try {
    const v = localStorage.getItem(KEY(id));
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * Store a result; returns true when it's a new best.
 * `direction`: "high" = bigger is better (score), "low" = smaller is better (ms/moves).
 * For "steady-breath" it's a cumulative cycle counter, always accumulates.
 */
export function recordResult(
  id: GameId,
  value: number,
  direction: "high" | "low" | "count",
): boolean {
  try {
    const prev = readBest(id);
    if (direction === "count") {
      localStorage.setItem(KEY(id), String((prev ?? 0) + value));
      return false;
    }
    const better =
      prev == null || (direction === "high" ? value > prev : value < prev);
    if (better) localStorage.setItem(KEY(id), String(value));
    return better;
  } catch {
    return false;
  }
}
