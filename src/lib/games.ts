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

/* ---- Focus Finder (Schulte grid) ----------------------------------------- */

export const SCHULTE_SIZE = 25;

/** Shuffled 1..25 number grid from a seeded RNG in [0,1). */
export function buildSchulteGrid(random: () => number = Math.random): number[] {
  const cells = Array.from({ length: SCHULTE_SIZE }, (_, i) => i + 1);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cells[i], cells[j]] = [cells[j]!, cells[i]!];
  }
  return cells;
}

/** Elapsed ms → score in seconds with one decimal (lower is better). */
export function schulteSeconds(elapsedMs: number): number {
  return Math.max(0.1, Math.round(elapsedMs / 100) / 10);
}

/* ---- Memory Trail (sequence recall) -------------------------------------- */

export const TRAIL_TILES = 9;
export const TRAIL_START_LENGTH = 3;

/** Extend a trail by one tile — never the same tile twice in a row. */
export function extendTrail(
  trail: number[],
  random: () => number = Math.random,
): number[] {
  const last = trail[trail.length - 1];
  let next = Math.floor(random() * TRAIL_TILES);
  if (next === last) {
    next = (next + 1 + Math.floor(random() * (TRAIL_TILES - 1))) % TRAIL_TILES;
  }
  return [...trail, next];
}

/** Starting trail of TRAIL_START_LENGTH tiles. */
export function buildTrail(random: () => number = Math.random): number[] {
  let trail: number[] = [];
  while (trail.length < TRAIL_START_LENGTH) trail = extendTrail(trail, random);
  return trail;
}

/* ---- Color Clash (Stroop) ------------------------------------------------ */

export const CLASH_COLOR_NAMES = ["Pink", "Blue", "Green", "Purple"] as const;
export const CLASH_ROUNDS = 12;

export interface ClashRound {
  /** Index into CLASH_COLOR_NAMES for the word shown. */
  word: number;
  /** Index into CLASH_COLOR_NAMES for the ink it's painted in — the answer. */
  ink: number;
}

/** One Stroop round; roughly 1 in 4 is congruent to keep players honest. */
export function buildClashRound(
  random: () => number = Math.random,
): ClashRound {
  const n = CLASH_COLOR_NAMES.length;
  const word = Math.floor(random() * n);
  if (random() < 0.25) return { word, ink: word };
  const shift = 1 + Math.floor(random() * (n - 1));
  return { word, ink: (word + shift) % n };
}

/* ---- Odd One Out (visual search) ----------------------------------------- */

/** Look-alike emoji pairs — every round hides one impostor among its twin. */
export const ODD_PAIRS: [string, string][] = [
  ["🙂", "🙃"],
  ["🐶", "🐺"],
  ["⭐", "🌟"],
  ["🍏", "🍐"],
  ["😺", "😸"],
  ["🌸", "🌺"],
  ["🔵", "🟣"],
  ["🌛", "🌜"],
];

export const ODD_ROUNDS = 8;

/** Grid side length for a round: 3×3 warm-up → 5×5 finale. */
export function oddGridSize(round: number): number {
  return round < 3 ? 3 : round < 6 ? 4 : 5;
}

/** Shuffled copy of ODD_PAIRS so each run meets the pairs in a new order. */
export function shuffledOddPairs(
  random: () => number = Math.random,
): [string, string][] {
  const pairs = [...ODD_PAIRS];
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j]!, pairs[i]!];
  }
  return pairs;
}

export interface OddRound {
  base: string;
  odd: string;
  size: number;
  oddIndex: number;
}

/** One round: pick which twin plays impostor and where it hides. */
export function buildOddRound(
  round: number,
  pair: [string, string],
  random: () => number = Math.random,
): OddRound {
  const flip = random() < 0.5;
  const base = flip ? pair[1] : pair[0];
  const odd = flip ? pair[0] : pair[1];
  const size = oddGridSize(round);
  const cells = size * size;
  const oddIndex = Math.min(Math.floor(random() * cells), cells - 1);
  return { base, odd, size, oddIndex };
}

/* ---- Digit Span (working memory) ----------------------------------------- */

export const SPAN_START = 3;

/** A digit string with no immediate repeats (kinder to read at a glance). */
export function makeSpan(
  len: number,
  random: () => number = Math.random,
): string {
  let span = "";
  for (let i = 0; i < len; i++) {
    let digit = Math.floor(random() * 10);
    if (i > 0 && Number(span[i - 1]) === digit) {
      digit = (digit + 1 + Math.floor(random() * 9)) % 10;
    }
    span += String(digit);
  }
  return span;
}

/** How long the digits stay visible before they vanish. */
export function spanShowMs(len: number): number {
  return 900 + len * 350;
}

/* ---- Green Light (go / no-go) --------------------------------------------- */

export const GO_ROUNDS = 24;
export const GO_SHOW_MS = 750;
export const GO_GAP_MS = 350;

/**
 * Stimulus plan: ~30% no-go, never more than two no-gos in a row, and the
 * first two are always go so the run starts in motion.
 */
export function buildGoSequence(
  random: () => number = Math.random,
): boolean[] {
  const seq: boolean[] = [];
  for (let i = 0; i < GO_ROUNDS; i++) {
    const twoNoGosBehind = i >= 2 && !seq[i - 1] && !seq[i - 2];
    seq.push(i < 2 || twoNoGosBehind || random() >= 0.3);
  }
  return seq;
}

/* ---- Night Sky (calm constellation tracing) ------------------------------- */

/**
 * Small invented constellations, points in normalized [0,1] canvas space,
 * traced in order. No timer, no failure — a wind-down, not a test.
 */
export const CONSTELLATIONS: { name: string; points: [number, number][] }[] = [
  {
    name: "The Kite",
    points: [
      [0.5, 0.08],
      [0.26, 0.32],
      [0.74, 0.34],
      [0.5, 0.58],
      [0.42, 0.8],
      [0.6, 0.92],
    ],
  },
  {
    name: "The Little Cup",
    points: [
      [0.18, 0.24],
      [0.36, 0.5],
      [0.6, 0.56],
      [0.82, 0.42],
      [0.74, 0.18],
      [0.46, 0.14],
    ],
  },
  {
    name: "The River",
    points: [
      [0.1, 0.85],
      [0.3, 0.62],
      [0.44, 0.72],
      [0.6, 0.45],
      [0.74, 0.52],
      [0.88, 0.18],
    ],
  },
  {
    name: "The Door",
    points: [
      [0.3, 0.85],
      [0.3, 0.25],
      [0.52, 0.1],
      [0.72, 0.25],
      [0.72, 0.85],
      [0.52, 0.6],
    ],
  },
  {
    name: "The Fox",
    points: [
      [0.14, 0.3],
      [0.34, 0.16],
      [0.52, 0.32],
      [0.72, 0.2],
      [0.86, 0.44],
      [0.62, 0.62],
      [0.36, 0.56],
    ],
  },
];

/** Pick tonight's constellation index from a [0,1) roll. */
export function pickConstellation(random: () => number = Math.random): number {
  return Math.min(
    Math.floor(random() * CONSTELLATIONS.length),
    CONSTELLATIONS.length - 1,
  );
}

/* ---- Letter Soup (unscramble) --------------------------------------------- */

/**
 * Everyday 5–6 letter words, curated so no entry shares its letters with a
 * common English anagram (no lemon/melon traps) — a correct-looking answer
 * can never be "wrong".
 */
export const SOUP_BANK: string[] = [
  "cocoa", "honey", "mango", "salad", "chair", "clock", "plant", "music",
  "paint", "cloud", "river", "light", "tulip", "daisy", "koala", "panda",
  "otter", "robin", "finch", "letter", "golden", "pebble", "purple",
  "yellow", "orange", "summer", "winter", "autumn", "spring", "coffee",
  "travel", "basket", "button", "candle", "pillow", "window", "breeze",
  "meadow", "sunset", "waffle", "muffin", "cookie", "puzzle", "rocket",
  "picnic", "ticket",
];

export const SOUP_ROUNDS = 8;

/** Seeded draw of SOUP_ROUNDS distinct words from the bank. */
export function pickSoupWords(
  random: () => number = Math.random,
): string[] {
  const idx = SOUP_BANK.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx.slice(0, SOUP_ROUNDS).map((i) => SOUP_BANK[i]!);
}

/** Shuffle a word's letters, guaranteed different from the original. */
export function scrambleWord(
  word: string,
  random: () => number = Math.random,
): string[] {
  const letters = word.split("");
  for (let attempt = 0; attempt < 12; attempt++) {
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [letters[i], letters[j]] = [letters[j]!, letters[i]!];
    }
    if (letters.join("") !== word) return letters;
  }
  // Pathological RNG: rotate by one, which always differs for length ≥ 2.
  return [...word.slice(1).split(""), word[0]!];
}

/* ---- Pattern Tiles (simultaneous spatial recall) -------------------------- */

export const PATTERN_GRID = 16;
export const PATTERN_START = 3;
export const PATTERN_MAX = 9;

/** Draw `count` distinct lit tiles on the 4×4 grid. */
export function pickPatternTiles(
  count: number,
  random: () => number = Math.random,
): number[] {
  const idx = Array.from({ length: PATTERN_GRID }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx.slice(0, Math.min(count, PATTERN_GRID)).sort((a, b) => a - b);
}

/** How long the pattern stays visible before it hides. */
export function patternShowMs(count: number): number {
  return 900 + count * 250;
}

/* ---- Proof It (find the wrong word) -------------------------------------- */

export interface ProofItem {
  /** Topic key (reuses QUIZ_TOPIC_LABELS where it overlaps). */
  topic: string;
  /** The sentence; exactly one space-separated word is wrong. */
  text: string;
  /** Index into text.split(" ") of the wrong word. */
  errorIndex: number;
  /**
   * What the wrong word should have been (with its punctuation, if any).
   * Empty string = the word shouldn't be there at all (doubled words).
   */
  fix: string;
  /** One-line memory hook, zero red-pen energy. */
  note: string;
}

export const PROOF_ROUNDS = 8;

/**
 * Proof It bank — 44 sentences, each hiding exactly one wrong word:
 * sound-alikes, spelling slips, tense wobbles, agreement misses, doubled
 * words, and apostrophe trouble. Editing as play, not punishment.
 */
export const PROOF_BANK: ProofItem[] = [
  /* -- sound-alikes -- */
  { topic: "homophones", text: "Their heading to the park after lunch.", errorIndex: 0, fix: "They're", note: "They're = they are. Their owns things; it can't head anywhere." },
  { topic: "homophones", text: "Grab you're coat — the rain looks serious.", errorIndex: 1, fix: "your", note: "Your owns the coat. You're = you are." },
  { topic: "homophones", text: "The dog wagged it's tail at every stranger.", errorIndex: 3, fix: "its", note: "Its owns the tail. It's always means it is." },
  { topic: "homophones", text: "We drove passed the bakery without stopping.", errorIndex: 2, fix: "past", note: "Past = beyond a place. Passed is the verb pass, done." },
  { topic: "homophones", text: "This backpack is to heavy for a day hike.", errorIndex: 3, fix: "too", note: "Too = excessively. To points somewhere." },
  { topic: "homophones", text: "The news had a big affect on the plan.", errorIndex: 5, fix: "effect", note: "Effect is the noun; affect is (usually) the verb." },
  { topic: "homophones", text: "My knew headphones cancel every distraction.", errorIndex: 1, fix: "new", note: "New = not old. Knew is the past of know." },
  { topic: "homophones", text: "There car is parked across two spaces.", errorIndex: 0, fix: "Their", note: "Their owns the car. There is a place." },
  { topic: "homophones", text: "I can't except another meeting this week.", errorIndex: 2, fix: "accept", note: "Accept = take in. Except = leave out." },
  { topic: "homophones", text: "The advise she gave me actually worked.", errorIndex: 1, fix: "advice", note: "Advice is the noun you get; advise is the verb you do." },
  { topic: "homophones", text: "Take a peak at the schedule before nine.", errorIndex: 2, fix: "peek", note: "Peek = a quick look. Peak = the top of a mountain." },
  { topic: "homophones", text: "The whether ruined our picnic plans again.", errorIndex: 1, fix: "weather", note: "Weather rains on picnics. Whether weighs choices." },
  /* -- spelling -- */
  { topic: "spelling", text: "She is definately coming to the party.", errorIndex: 2, fix: "definitely", note: "Definitely has finite inside it — no a anywhere." },
  { topic: "spelling", text: "That was a wierd way to end a meeting.", errorIndex: 3, fix: "weird", note: "Weird is weird — it breaks the i-before-e rule." },
  { topic: "spelling", text: "Thanks — I really appriciate the reminder.", errorIndex: 4, fix: "appreciate", note: "Appreciate: to get its e's right, think of getting a price." },
  { topic: "spelling", text: "Seperate the laundry before you start.", errorIndex: 0, fix: "Separate", note: "There's a rat in separate." },
  { topic: "spelling", text: "It happend again right after the reset.", errorIndex: 1, fix: "happened", note: "Happened keeps the full -ened. Happen + ed." },
  { topic: "spelling", text: "The enviroment here is great for focus.", errorIndex: 1, fix: "environment", note: "Environment hides iron in the middle: env-iron-ment." },
  { topic: "spelling", text: "Tomorow is fully booked with appointments.", errorIndex: 0, fix: "Tomorrow", note: "Tomorrow: one m, two r's. Borrow an r, not an m." },
  { topic: "spelling", text: "Which restaraunt did you end up choosing?", errorIndex: 1, fix: "restaurant", note: "Restaurant keeps the French -aur-: rest-au-rant." },
  /* -- tense -- */
  { topic: "tense", text: "Yesterday she run the whole loop twice.", errorIndex: 2, fix: "ran", note: "Yesterday pushes run into the past: ran." },
  { topic: "tense", text: "He has went home early every day this week.", errorIndex: 2, fix: "gone", note: "After has, go becomes gone. Went stands alone." },
  { topic: "tense", text: "We seen that movie at the drive-in.", errorIndex: 1, fix: "saw", note: "Saw stands alone; seen needs a helper (have seen)." },
  { topic: "tense", text: "They had already ate when we arrived.", errorIndex: 3, fix: "eaten", note: "After had, eat becomes eaten. Ate stands alone." },
  { topic: "tense", text: "I should have wrote that reminder down.", errorIndex: 3, fix: "written", note: "After have, write becomes written. Wrote stands alone." },
  { topic: "tense", text: "The package come this morning after all.", errorIndex: 2, fix: "came", note: "This morning is past — come becomes came." },
  /* -- agreement -- */
  { topic: "agreement", text: "The list of chores were longer than expected.", errorIndex: 4, fix: "was", note: "The list was long — one list, even with many chores on it." },
  { topic: "agreement", text: "Each of the players have a favorite warm-up.", errorIndex: 4, fix: "has", note: "Each is singular, no matter how many players follow it." },
  { topic: "agreement", text: "She don't usually plan this far ahead.", errorIndex: 1, fix: "doesn't", note: "She doesn't. Don't belongs to I, you, we, and they." },
  { topic: "agreement", text: "There is three reminders set for tonight.", errorIndex: 1, fix: "are", note: "Three reminders are. Is would need just one." },
  { topic: "agreement", text: "Neither of the routes are faster at rush hour.", errorIndex: 4, fix: "is", note: "Neither is singular — neither one is faster." },
  { topic: "agreement", text: "The team have picked its new captain.", errorIndex: 2, fix: "has", note: "The team acts as one thing here: the team has." },
  /* -- doubled words -- */
  { topic: "word-choice", text: "Meet me at at the corner around noon.", errorIndex: 3, fix: "", note: "A doubled little word — the eye skates right over it." },
  { topic: "word-choice", text: "I think that that plan needs one more step.", errorIndex: 3, fix: "", note: "One that too many. Reading aloud catches these." },
  { topic: "word-choice", text: "She said the the meeting moved to Thursday.", errorIndex: 3, fix: "", note: "Double the — the most-missed typo in proofreading." },
  /* -- word choice -- */
  { topic: "word-choice", text: "Can you borrow me a pen for the form?", errorIndex: 2, fix: "lend", note: "You lend out; you borrow in. The pen travels lend-ward." },
  { topic: "word-choice", text: "Lay down for twenty minutes before the call.", errorIndex: 0, fix: "Lie", note: "Lie down yourself; lay down an object." },
  { topic: "word-choice", text: "The sunset last night was very unique.", errorIndex: 5, fix: "truly", note: "Unique can't be very — it's already one of a kind." },
  { topic: "word-choice", text: "Irregardless of the score, we play again Friday.", errorIndex: 0, fix: "Regardless", note: "Regardless already means without regard — the ir- doubles the negative." },
  { topic: "word-choice", text: "I could of finished it with ten more minutes.", errorIndex: 2, fix: "have", note: "Could have — could've just sounds like could of." },
  /* -- apostrophes -- */
  { topic: "apostrophes", text: "The Smiths dog knows everyone on the street.", errorIndex: 1, fix: "Smiths'", note: "The dog belongs to the Smiths: Smiths' (whole-family possessive)." },
  { topic: "apostrophes", text: "Fresh bagel's are half price after four.", errorIndex: 1, fix: "bagels", note: "Plain plural, no apostrophe — the bagels own nothing." },
  { topic: "apostrophes", text: "Whos turn is it to water the plants?", errorIndex: 0, fix: "Whose", note: "Whose owns the turn. Who's = who is." },
  { topic: "apostrophes", text: "The teams jerseys arrived a size too small.", errorIndex: 1, fix: "team's", note: "The jerseys belong to the team: team's." },
];

/** The sentence as tappable word chips. */
export function proofWords(item: ProofItem): string[] {
  return item.text.split(" ");
}

/** The sentence with the wrong word corrected (or dropped, for doubles). */
export function proofCorrected(item: ProofItem): string {
  const words = proofWords(item);
  if (item.fix === "") {
    words.splice(item.errorIndex, 1);
  } else {
    words[item.errorIndex] = item.fix;
  }
  return words.join(" ");
}

/**
 * Whether a tapped word index counts as finding the error. For doubled words
 * the two twins are indistinguishable chips — tapping either is a find.
 */
export function isProofHit(item: ProofItem, tapped: number): boolean {
  if (tapped === item.errorIndex) return true;
  const words = proofWords(item);
  return (
    Math.abs(tapped - item.errorIndex) === 1 &&
    words[tapped] === words[item.errorIndex]
  );
}

/**
 * Pick N proof rounds: seeded shuffle with the same topic-spread pass as the
 * quizzes (at most `maxPerTopic` per topic, refill on shortfall). Word order
 * inside a sentence is fixed by the sentence itself, so no per-item shuffle.
 */
export function pickProofRounds(
  bank: ProofItem[],
  n: number = PROOF_ROUNDS,
  random: () => number = Math.random,
  opts: { maxPerTopic?: number } = {},
): ProofItem[] {
  const maxPerTopic = opts.maxPerTopic ?? 2;
  const idx = bank.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }

  const want = Math.min(n, bank.length);
  const taken: number[] = [];
  const perTopic = new Map<string, number>();
  for (const i of idx) {
    if (taken.length >= want) break;
    const topic = bank[i]!.topic;
    if ((perTopic.get(topic) ?? 0) >= maxPerTopic) continue;
    perTopic.set(topic, (perTopic.get(topic) ?? 0) + 1);
    taken.push(i);
  }
  for (const i of idx) {
    if (taken.length >= want) break;
    if (!taken.includes(i)) taken.push(i);
  }

  return taken.map((i) => bank[i]!);
}

/** Proof items whose texts are on the missed list (practice pool). */
export function proofMissedItems(
  bank: ProofItem[],
  misses: string[],
): ProofItem[] {
  return bank.filter((item) => misses.includes(item.text));
}

/* ---- localStorage bests -------------------------------------------------- */

export type GameId =
  | "time-feel"
  | "quick-tap"
  | "emoji-match"
  | "steady-breath"
  | "grammar-snap"
  | "spell-check"
  | "number-hunt"
  | "memory-trail"
  | "color-clash"
  | "odd-one-out"
  | "digit-span"
  | "green-light"
  | "night-sky"
  | "letter-soup"
  | "pattern-tiles"
  | "proof-it";

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
