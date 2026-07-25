/**
 * Weekly intentions (H7) — the shared rules for the week's 1–3 gentle aims.
 *
 * Stored in `settings.notificationPrefs.intentions` as `{ week, items }` so the
 * web Week page and the iOS Weekly Intentions card read the same blob. The
 * week key gates them: aims from a previous week simply stop showing, which is
 * how "resets Monday, no guilt" is implemented — nothing is ever marked missed.
 *
 * Pure module: no DOM, no fetch. Safe to import from anywhere.
 */

export interface Intention {
  text: string;
  done: boolean;
}

export interface StoredIntentions {
  week: string;
  items: Intention[];
}

/** Three is the cap on purpose — more aims is how a week starts feeling like a backlog. */
export const MAX_INTENTIONS = 3;
/** Matches the `maxLength` on the input; enforced here too for iOS-written values. */
export const MAX_INTENTION_LENGTH = 80;

function sanitizeItem(raw: unknown): Intention | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.text !== "string") return null;
  const text = r.text.trim().slice(0, MAX_INTENTION_LENGTH);
  if (!text) return null;
  return { text, done: r.done === true };
}

/**
 * Read this week's aims out of a prefs blob. Returns `[]` when the stored blob
 * belongs to another week, is missing, or is malformed — callers can render the
 * empty state without branching on shape.
 */
export function parseIntentions(prefs: unknown, weekStart: string): Intention[] {
  if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) return [];
  const raw = (prefs as Record<string, unknown>).intentions;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const stored = raw as Record<string, unknown>;
  if (stored.week !== weekStart) return [];
  if (!Array.isArray(stored.items)) return [];
  const items: Intention[] = [];
  for (const entry of stored.items) {
    const item = sanitizeItem(entry);
    if (item) items.push(item);
    if (items.length === MAX_INTENTIONS) break;
  }
  return items;
}

/** Merge aims back into a prefs blob, leaving every other key untouched. */
export function writeIntentions(
  prefs: Record<string, unknown> | null | undefined,
  weekStart: string,
  items: Intention[],
): Record<string, unknown> {
  return {
    ...(prefs ?? {}),
    intentions: { week: weekStart, items: items.slice(0, MAX_INTENTIONS) },
  };
}

/**
 * Append an aim. Returns the same array reference when the text is blank, a
 * duplicate, or the cap is reached, so callers can skip a needless write.
 */
export function addIntention(items: Intention[], text: string): Intention[] {
  const clean = text.trim().slice(0, MAX_INTENTION_LENGTH);
  if (!clean) return items;
  if (items.length >= MAX_INTENTIONS) return items;
  const lower = clean.toLowerCase();
  if (items.some((it) => it.text.toLowerCase() === lower)) return items;
  return [...items, { text: clean, done: false }];
}

/** Flip done/not-done. Out-of-range indexes are a no-op. */
export function toggleIntention(items: Intention[], index: number): Intention[] {
  if (index < 0 || index >= items.length) return items;
  return items.map((it, i) => (i === index ? { ...it, done: !it.done } : it));
}

/** Drop an aim. Out-of-range indexes are a no-op. */
export function removeIntention(items: Intention[], index: number): Intention[] {
  if (index < 0 || index >= items.length) return items;
  return items.filter((_, i) => i !== index);
}

/** Counts for progress copy. `allDone` is false for an empty week (nothing to celebrate yet). */
export function intentionsProgress(items: Intention[]): {
  total: number;
  done: number;
  allDone: boolean;
} {
  const done = items.reduce((n, it) => n + (it.done ? 1 : 0), 0);
  return { total: items.length, done, allDone: items.length > 0 && done === items.length };
}
