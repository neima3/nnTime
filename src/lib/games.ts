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
  /** Topic slug — the picker spreads a run across topics. */
  topic?: string;
}

/** Human labels for quiz topics (shown as a small chip on questions). */
export const QUIZ_TOPIC_LABELS: Record<string, string> = {
  homophones: "sound-alikes",
  apostrophes: "apostrophes",
  agreement: "matching up",
  pronouns: "pronouns",
  comparisons: "comparisons",
  "verb-pairs": "tricky verbs",
  tense: "past tense",
  "word-choice": "word choice",
  negation: "double negatives",
  spelling: "spelling",
};

export const QUIZ_ROUNDS = 8;

/**
 * Grammar Snap bank — 64 snags across ten topics: sound-alikes,
 * apostrophes, agreement, pronouns, comparisons, tricky verb pairs, tense,
 * word choice, and double negatives. Tone: playful, zero red-pen energy.
 * The picker guarantees topic spread, so no run is eight rounds of its/it's.
 */
export const GRAMMAR_BANK: QuizItem[] = [
  /* -- sound-alikes (homophones) -- */
  { topic: "homophones", prompt: "___ going to love this timeline.", options: ["Your", "You're"], answer: "You're", note: "You're = you are. Your = it belongs to you." },
  { topic: "homophones", prompt: "___ meeting starts in five minutes.", options: ["They're", "Their", "There"], answer: "Their", note: "Their = belongs to them. There = a place. They're = they are." },
  { topic: "homophones", prompt: "We planned more breaks ___ we actually took.", options: ["then", "than"], answer: "than", note: "Than compares. Then is about time." },
  { topic: "homophones", prompt: "Coffee has a strong ___ on my morning plans.", options: ["affect", "effect"], answer: "effect", note: "Effect is (usually) the noun; affect is the verb." },
  { topic: "homophones", prompt: "Don't ___ your keys again — put them in the bowl.", options: ["loose", "lose"], answer: "lose", note: "Lose = misplace. Loose = not tight. One o of difference." },
  { topic: "homophones", prompt: "I'm ___ tired to argue about semicolons.", options: ["to", "too", "two"], answer: "too", note: "Too = also / excessively. To = direction. Two = 2." },
  { topic: "homophones", prompt: "I walked ___ the old library on my way home.", options: ["passed", "past"], answer: "past", note: "Past = beyond (place/time). Passed = the verb pass, done." },
  { topic: "homophones", prompt: "Time ___ faster during hyperfocus.", options: ["passed", "past"], answer: "passed", note: "Here it's the verb: time passes, time passed." },
  { topic: "homophones", prompt: "I can't decide ___ to nap or to snack.", options: ["weather", "whether"], answer: "whether", note: "Whether = choice. Weather = rain and sunshine." },
  { topic: "homophones", prompt: "Ice cream after a hard day is a just ___.", options: ["desert", "dessert"], answer: "dessert", note: "Dessert has two s's — you always want seconds." },
  { topic: "homophones", prompt: "Please ___ before the stop sign.", options: ["brake", "break"], answer: "brake", note: "Brake stops the car. Break is what you take at 3pm." },
  { topic: "homophones", prompt: "Reading ___ is allowed in the quiet car. Wait—", options: ["aloud", "allowed"], answer: "aloud", note: "Aloud = out loud. Allowed = permitted." },
  { topic: "homophones", prompt: "That scarf really ___ your eyes.", options: ["complements", "compliments"], answer: "complements", note: "Complement completes. Compliment flatters." },
  { topic: "homophones", prompt: "The ___ of the school knew everyone's name.", options: ["principal", "principle"], answer: "principal", note: "The principal is your pal (allegedly). A principle is a rule." },
  { topic: "homophones", prompt: "The car stayed ___ while the light was red.", options: ["stationary", "stationery"], answer: "stationary", note: "StationAry = not moving. StationEry = envelopes (e for envelope)." },
  { topic: "homophones", prompt: "A quiet morning brings a rare peace of ___.", options: ["mind", "mine"], answer: "mind", note: "Peace of mind — your mind, at peace. (Piece of cake is the other one.)" },

  /* -- apostrophes & ownership -- */
  { topic: "apostrophes", prompt: "The cat licked ___ paw and judged us all.", options: ["its", "it's"], answer: "its", note: "It's = it is. The cat owns the paw, so: its." },
  { topic: "apostrophes", prompt: "___ turn is it to water the plant?", options: ["Whose", "Who's"], answer: "Whose", note: "Who's = who is. Whose owns things." },
  { topic: "apostrophes", prompt: "The ___ toys are everywhere.", options: ["dogs'", "dog's", "dogs"], answer: "dogs'", note: "Several dogs own the toys → apostrophe after the s: dogs'." },
  { topic: "apostrophes", prompt: "Music from the ___ still slaps.", options: ["1990s", "1990's"], answer: "1990s", note: "Decades are plain plurals: the 1990s. No apostrophe needed." },
  { topic: "apostrophes", prompt: "That backpack is ___.", options: ["hers", "her's"], answer: "hers", note: "Hers, ours, yours, theirs — possessive pronouns never take apostrophes." },
  { topic: "apostrophes", prompt: "___ been a long week already.", options: ["Its", "It's"], answer: "It's", note: "It's = it is / it has. This one is 'it has been' — apostrophe earned." },

  /* -- matching up (agreement) -- */
  { topic: "agreement", prompt: "The plan ___ fine until lunch happened.", options: ["was", "were"], answer: "was", note: "One plan → was. Plural things → were." },
  { topic: "agreement", prompt: "Neither of the timers ___ set.", options: ["was", "were"], answer: "was", note: "Neither is singular at heart — neither one was set." },
  { topic: "agreement", prompt: "Each of the steps ___ five minutes.", options: ["takes", "take"], answer: "takes", note: "Each = one at a time → singular verb. Each one takes." },
  { topic: "agreement", prompt: "There ___ three snacks left in the drawer.", options: ["is", "are"], answer: "are", note: "Three snacks are. Flip it: 'three snacks are there.'" },
  { topic: "agreement", prompt: "A list of tasks ___ waiting in the inbox.", options: ["is", "are"], answer: "is", note: "The LIST is waiting (one list) — 'of tasks' is just decoration." },
  { topic: "agreement", prompt: "Everyone on both teams ___ trying their best.", options: ["is", "are"], answer: "is", note: "Everyone is singular, always — even in a crowd." },
  { topic: "agreement", prompt: "The pair of scissors ___ missing again.", options: ["is", "are"], answer: "is", note: "The pair is one thing (even with two blades)." },

  /* -- pronouns -- */
  { topic: "pronouns", prompt: "Between you and ___, this app gets me.", options: ["me", "I"], answer: "me", note: "After a preposition (between), it's me. Fancy ≠ correct." },
  { topic: "pronouns", prompt: "The snacks are for ___ finishes their review.", options: ["whoever", "whomever"], answer: "whoever", note: "Whoever does the finishing — subjects get whoever." },
  { topic: "pronouns", prompt: "My friend and ___ built a pillow fort.", options: ["I", "me", "myself"], answer: "I", note: "Drop the friend: 'I built a fort.' Subjects get I." },
  { topic: "pronouns", prompt: "They saved seats for Sam and ___.", options: ["I", "me", "myself"], answer: "me", note: "Drop Sam: 'they saved a seat for me.' Objects get me." },
  { topic: "pronouns", prompt: "___ should I say is calling?", options: ["Who", "Whom"], answer: "Who", note: "Who is doing the calling → who. (Whom = him test: 'him is calling'? No.)" },
  { topic: "pronouns", prompt: "To ___ should I address this very formal letter?", options: ["who", "whom"], answer: "whom", note: "To him → to whom. The him-test works every time." },
  { topic: "pronouns", prompt: "I fixed it ___ — no tutorial needed.", options: ["myself", "meself", "my own self"], answer: "myself", note: "Myself is for emphasis or reflexives — and this one's earned." },

  /* -- comparisons -- */
  { topic: "comparisons", prompt: "She did ___ on the exam than she expected.", options: ["better", "more better"], answer: "better", note: "Better is already the comparison — it flies solo." },
  { topic: "comparisons", prompt: "The express lane: ten items or ___.", options: ["fewer", "less"], answer: "fewer", note: "Fewer for things you can count. Less for stuff you can't (less time, fewer minutes)." },
  { topic: "comparisons", prompt: "I have ___ energy after lunch than before.", options: ["fewer", "less"], answer: "less", note: "Energy isn't countable → less energy. (Fewer naps, less sleep.)" },
  { topic: "comparisons", prompt: "How much ___ is the trailhead?", options: ["farther", "further"], answer: "farther", note: "Farther = physical distance. Further = more of anything else." },
  { topic: "comparisons", prompt: "Let's discuss this ___ after snacks.", options: ["farther", "further"], answer: "further", note: "Ideas go further; roads go farther." },
  { topic: "comparisons", prompt: "The focus timer works really ___.", options: ["good", "well"], answer: "well", note: "Things work well (adverb). The result can be good (adjective)." },
  { topic: "comparisons", prompt: "Of the two routes, this one is ___.", options: ["shorter", "shortest"], answer: "shorter", note: "Two things → -er. Three or more → -est." },

  /* -- tricky verb pairs -- */
  { topic: "verb-pairs", prompt: "I'm going to ___ down for ten minutes.", options: ["lie", "lay"], answer: "lie", note: "You lie down yourself; you lay something else down. (Lay needs an object.)" },
  { topic: "verb-pairs", prompt: "___ the blanket on the couch, please.", options: ["Lie", "Lay"], answer: "Lay", note: "Laying the blanket — lay takes an object." },
  { topic: "verb-pairs", prompt: "Can I ___ your charger until lunch?", options: ["borrow", "lend"], answer: "borrow", note: "You borrow FROM someone; they lend TO you." },
  { topic: "verb-pairs", prompt: "Could you ___ me five minutes of quiet?", options: ["borrow", "lend"], answer: "lend", note: "They give it → lend. You take it → borrow." },
  { topic: "verb-pairs", prompt: "___ the timer for twenty minutes.", options: ["Sit", "Set"], answer: "Set", note: "You set things down/up; you sit yourself." },
  { topic: "verb-pairs", prompt: "Bread ___ when the yeast wakes up.", options: ["rises", "raises"], answer: "rises", note: "Things rise on their own; you raise something else." },
  { topic: "verb-pairs", prompt: "___ your snacks when you come over.", options: ["Bring", "Take"], answer: "Bring", note: "Bring = toward the speaker. Take = away. Come here and bring snacks." },

  /* -- past tense & participles -- */
  { topic: "tense", prompt: "I ___ have gone to bed earlier.", options: ["should of", "should have"], answer: "should have", note: "\"Should of\" is \"should've\" playing dress-up. It's should have." },
  { topic: "tense", prompt: "I've ___ that movie three times this week.", options: ["saw", "seen"], answer: "seen", note: "With have/has: seen. Alone: saw. (I saw it; I have seen it.)" },
  { topic: "tense", prompt: "She has ___ to that cafe every day this week.", options: ["went", "gone"], answer: "gone", note: "With have/has: gone. Went stands alone. (She went; she has gone.)" },
  { topic: "tense", prompt: "The timer had already ___ when I looked up.", options: ["rang", "rung"], answer: "rung", note: "Ring, rang, (has/had) rung — the u shows up with had." },
  { topic: "tense", prompt: "I ___ my water bottle somewhere in this house.", options: ["should have left", "should have leaved"], answer: "should have left", note: "Leave, left, left. 'Leaved' only happens to trees, and not even then." },
  { topic: "tense", prompt: "We had ___ our best plans by 9 a.m.", options: ["abandoned", "abandonded"], answer: "abandoned", note: "Just one -ed. (Also: relatable.)" },

  /* -- word choice -- */
  { topic: "word-choice", prompt: "___ a nap change everything? Absolutely.", options: ["Can", "May"], answer: "Can", note: "Can = ability. May = permission. Naps need no permission." },
  { topic: "word-choice", prompt: "Bring a snack — ___, something chocolatey.", options: ["e.g.", "i.e."], answer: "e.g.", note: "e.g. = for example. i.e. = that is (an exact restatement)." },
  { topic: "word-choice", prompt: "I water the plants ___ — it's my anchor habit.", options: ["everyday", "every day"], answer: "every day", note: "Every day = each day. Everyday = ordinary ('everyday shoes')." },
  { topic: "word-choice", prompt: "That took ___ of courage.", options: ["alot", "a lot", "allot"], answer: "a lot", note: "A lot is two words. Allot means to portion out. Alot is a mythical creature." },
  { topic: "word-choice", prompt: "Split the dessert ___ the three of us.", options: ["between", "among"], answer: "among", note: "Between two; among three or more." },
  { topic: "word-choice", prompt: "The ___ of steps doesn't matter — starting does.", options: ["amount", "number"], answer: "number", note: "Number for countables (steps); amount for stuff (effort)." },
  { topic: "word-choice", prompt: "Turn your to-dos ___ time blocks.", options: ["into", "in to"], answer: "into", note: "Into = transformation/entering. 'In to' is two separate jobs ('log in to the app')." },

  /* -- double negatives -- */
  { topic: "negation", prompt: "I can ___ believe the week is over.", options: ["hardly", "not hardly"], answer: "hardly", note: "Hardly is already negative — it works alone." },
  { topic: "negation", prompt: "I couldn't care ___ about perfect handwriting.", options: ["less", "fewer"], answer: "less", note: "Couldn't care less = zero care left. ('Could care less' means you still do!)" },
  { topic: "negation", prompt: "We didn't do ___ wrong.", options: ["anything", "nothing"], answer: "anything", note: "Didn't + nothing cancels out. One negative per sentence does the job." },
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
 * Pick N quiz rounds: seeded shuffle of the bank with a topic-spread pass
 * (at most `maxPerTopic` questions from one topic per run, so a draw never
 * turns into eight rounds of its/it's), then per-item option shuffle so the
 * answer position varies. Returns new arrays (bank untouched).
 */
export function pickQuizRounds(
  bank: QuizItem[],
  n: number = QUIZ_ROUNDS,
  random: () => number = Math.random,
  opts: { maxPerTopic?: number } = {},
): QuizItem[] {
  const maxPerTopic = opts.maxPerTopic ?? 2;
  const idx = bank.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }

  const want = Math.min(n, bank.length);
  const taken: number[] = [];
  const perTopic = new Map<string, number>();
  // First pass honors the topic cap; second pass fills any shortfall.
  for (const i of idx) {
    if (taken.length >= want) break;
    const topic = bank[i]!.topic ?? "general";
    if ((perTopic.get(topic) ?? 0) >= maxPerTopic) continue;
    perTopic.set(topic, (perTopic.get(topic) ?? 0) + 1);
    taken.push(i);
  }
  for (const i of idx) {
    if (taken.length >= want) break;
    if (!taken.includes(i)) taken.push(i);
  }

  return taken.map((i) => {
    const item = bank[i]!;
    const options = [...item.options];
    for (let k = options.length - 1; k > 0; k--) {
      const j = Math.floor(random() * (k + 1));
      [options[k], options[j]] = [options[j]!, options[k]!];
    }
    return { ...item, options };
  });
}

/* ---- Missed-item practice ("your tricky ones") --------------------------- */

const MISS_KEY = (id: GameId) => `kairo-play-misses-${id}`;
const MISS_CAP = 40;

/** Prompts the player has answered wrong and not yet redeemed. */
export function readMisses(id: GameId): string[] {
  try {
    const raw = localStorage.getItem(MISS_KEY(id));
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Remember a miss (deduped, newest last, capped). */
export function recordMiss(id: GameId, prompt: string): void {
  try {
    const list = readMisses(id).filter((p) => p !== prompt);
    list.push(prompt);
    localStorage.setItem(MISS_KEY(id), JSON.stringify(list.slice(-MISS_CAP)));
  } catch {}
}

/** A correct answer redeems the prompt — it leaves the tricky list. */
export function clearMiss(id: GameId, prompt: string): void {
  try {
    const list = readMisses(id).filter((p) => p !== prompt);
    localStorage.setItem(MISS_KEY(id), JSON.stringify(list));
  } catch {}
}

/** Bank items matching the stored missed prompts (order: oldest miss first). */
export function missedItems(bank: QuizItem[], misses: string[]): QuizItem[] {
  return misses
    .map((p) => bank.find((item) => item.prompt === p))
    .filter((x): x is QuizItem => x != null);
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
