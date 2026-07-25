/**
 * Planner search — matching + ranking (H3).
 *
 * Powers `GET /api/v1/search`, which the iOS Search screen and the web command
 * palette both consume. Kept pure and separate from the DAL so the ranking rules
 * are testable without a database, and identical on both platforms.
 *
 * Ranking intent: what someone means when they type three letters into a planner
 * is almost always "that thing I named" — so a title prefix beats a title
 * substring, which beats a note match. Ties break toward the nearer date,
 * because "the one coming up" is the usual target.
 */

export type SearchKind = "activity" | "task";

export interface SearchCandidate {
  id: string;
  kind: SearchKind;
  title: string;
  notes?: string | null;
  emoji?: string | null;
  /** ISO date (YYYY-MM-DD) for scheduled items; null for inbox/anytime. */
  date?: string | null;
  /** Minutes from midnight, for scheduled activities. */
  startMin?: number | null;
  categoryId?: string | null;
  done?: boolean;
}

export interface SearchHit extends SearchCandidate {
  score: number;
  /** Which field produced the match — the UI labels note matches. */
  matchedOn: "title" | "notes";
}

/** Normalize for comparison: casefold, strip accents, collapse whitespace. */
export function normalizeQuery(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

const TITLE_EXACT = 1000;
const TITLE_PREFIX = 500;
const TITLE_WORD_PREFIX = 300;
const TITLE_SUBSTRING = 150;
const NOTES_SUBSTRING = 40;

/**
 * Score one candidate against a normalized query. Returns null for no match, so
 * callers can filter without a magic sentinel.
 */
export function scoreCandidate(
  candidate: SearchCandidate,
  q: string,
): { score: number; matchedOn: "title" | "notes" } | null {
  if (!q) return null;
  const title = normalizeQuery(candidate.title ?? "");
  if (title === q) return { score: TITLE_EXACT, matchedOn: "title" };
  if (title.startsWith(q)) return { score: TITLE_PREFIX, matchedOn: "title" };
  // A word-boundary hit ("work" in "Deep work") reads as intentional; a hit in
  // the middle of a word ("ork") usually doesn't.
  if (title.split(" ").some((w) => w.startsWith(q))) {
    return { score: TITLE_WORD_PREFIX, matchedOn: "title" };
  }
  if (title.includes(q)) return { score: TITLE_SUBSTRING, matchedOn: "title" };
  const notes = normalizeQuery(candidate.notes ?? "");
  if (notes && notes.includes(q)) return { score: NOTES_SUBSTRING, matchedOn: "notes" };
  return null;
}

/** Days between an ISO date and a reference ISO date; 0 when either is absent. */
function dayDistance(date: string | null | undefined, today: string): number {
  if (!date) return 0;
  const a = Date.parse(`${date}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.abs(Math.round((a - b) / 86_400_000));
}

export interface SearchOptions {
  /** Reference date (YYYY-MM-DD) for proximity tie-breaking. */
  today: string;
  /** Hard cap on returned hits. */
  limit?: number;
}

/**
 * Match, rank, and cap. Stable: equal-scoring items keep a deterministic order
 * (date proximity, then date, then title) so the list doesn't shuffle between
 * identical queries.
 */
export function searchCandidates(
  candidates: SearchCandidate[],
  query: string,
  { today, limit = 25 }: SearchOptions,
): SearchHit[] {
  const q = normalizeQuery(query);
  if (!q) return [];

  const hits: SearchHit[] = [];
  for (const candidate of candidates) {
    const scored = scoreCandidate(candidate, q);
    if (!scored) continue;
    // Nearer dates edge ahead, but proximity can never outrank a better field
    // match: the bonus is capped well below the gap between score tiers.
    const proximity = Math.max(0, 60 - dayDistance(candidate.date, today));
    hits.push({ ...candidate, score: scored.score + proximity, matchedOn: scored.matchedOn });
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const da = dayDistance(a.date, today);
    const db = dayDistance(b.date, today);
    if (da !== db) return da - db;
    if ((a.date ?? "") !== (b.date ?? "")) return (a.date ?? "").localeCompare(b.date ?? "");
    if ((a.startMin ?? 0) !== (b.startMin ?? 0)) return (a.startMin ?? 0) - (b.startMin ?? 0);
    return a.title.localeCompare(b.title);
  });

  return hits.slice(0, Math.max(0, limit));
}

/** "Today" / "Tomorrow" / "Sat 26 Jul" / "Anytime" — one shared date label. */
export function searchDateLabel(
  date: string | null | undefined,
  today: string,
): string {
  if (!date) return "Anytime";
  if (date === today) return "Today";
  const t = Date.parse(`${today}T00:00:00Z`);
  const d = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isNaN(t) && !Number.isNaN(d)) {
    const diff = Math.round((d - t) / 86_400_000);
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
