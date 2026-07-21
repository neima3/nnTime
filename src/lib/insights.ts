/**
 * Insights derivations — pure, testable, and the single source of truth the
 * iOS app mirrors. Extracted from RewardGarden / WeeklyReflection /
 * PeakFocusNudge so the "growth that isn't a streak" and "gentle patterns"
 * logic lives in one place with unit coverage.
 */

// ---------------------------------------------------------------------------
// Reward Garden (P12) — cumulative growth that never resets.
// ---------------------------------------------------------------------------

export type GardenStage = { emoji: string; name: string; at: number };

export const GARDEN_STAGES: GardenStage[] = [
  { emoji: "🌱", name: "a seed", at: 0 },
  { emoji: "🌿", name: "a sprout", at: 3 },
  { emoji: "🪴", name: "growing", at: 8 },
  { emoji: "🌷", name: "in bloom", at: 16 },
  { emoji: "🌳", name: "flourishing", at: 32 },
];

/** One bloom in the meadow per this many completions. */
export const GARDEN_PER_BLOOM = 3;
export const GARDEN_MAX_BLOOMS = 24;

export interface GardenState {
  points: number;
  stageIndex: number;
  stage: GardenStage;
  next: GardenStage | null;
  toNext: number;
  bloomCount: number;
}

/**
 * Points = every completion + every ~25-min focus block. Stage is the highest
 * threshold reached; blooms scale with completions. Never decreases on a
 * missed day — the inputs are cumulative totals.
 */
export function gardenState(
  totalCompleted: number,
  totalFocusMin: number,
): GardenState {
  const completed = Math.max(0, Math.floor(totalCompleted));
  const focusBlocks = Math.max(0, Math.floor(totalFocusMin / 25));
  const points = completed + focusBlocks;

  let stageIndex = 0;
  for (let i = GARDEN_STAGES.length - 1; i >= 0; i--) {
    if (points >= GARDEN_STAGES[i]!.at) {
      stageIndex = i;
      break;
    }
  }
  const stage = GARDEN_STAGES[stageIndex]!;
  const next = GARDEN_STAGES[stageIndex + 1] ?? null;
  const toNext = next ? next.at - points : 0;
  const bloomCount = Math.min(
    GARDEN_MAX_BLOOMS,
    Math.floor(completed / GARDEN_PER_BLOOM),
  );

  return { points, stageIndex, stage, next, toNext, bloomCount };
}

// ---------------------------------------------------------------------------
// Weekly Reflection (P13) — gentle patterns, only when there's enough signal.
// ---------------------------------------------------------------------------

export const WEEKDAYS = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

export function hourLabel(h: number): string {
  if (h === 0) return "midnight";
  if (h === 12) return "noon";
  const period = h < 12 ? "am" : "pm";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}${period}`;
}

export interface ReflectionInput {
  byDate: Record<string, { completed: number; focusMin: number; mood: string | null }>;
  totalCompleted: number;
  totalFocusMin: number;
  peakHour: number | null;
}

/**
 * Returns 0–4 warm observations. Empty until ≥3 completions so quiet weeks are
 * left in peace. Caller typically shows the first 3.
 */
export function reflectionNotes(input: ReflectionInput): string[] {
  const { byDate, totalCompleted, totalFocusMin, peakHour } = input;
  if (totalCompleted < 3) return [];

  const notes: string[] = [];

  const byWeekday = new Array(7).fill(0);
  let activeDays = 0;
  for (const [key, v] of Object.entries(byDate)) {
    if (v.completed > 0) {
      activeDays++;
      const d = new Date(key + "T00:00:00");
      byWeekday[d.getDay()] += v.completed;
    }
  }
  const bestDow = byWeekday.indexOf(Math.max(...byWeekday));
  if (byWeekday[bestDow] >= 2) {
    notes.push(
      `${WEEKDAYS[bestDow]} tend to be yours — that's where the most got finished.`,
    );
  }

  if (totalFocusMin >= 25) {
    const h = Math.round(totalFocusMin / 6) / 10;
    notes.push(
      `You gave about ${h < 1 ? `${totalFocusMin} focused minutes` : `${h} focused hours`} — time you chose to spend on what mattered.`,
    );
  }

  if (peakHour != null) {
    notes.push(
      `Your attention lands most around ${hourLabel(peakHour)}. Worth guarding for the hard things.`,
    );
  }

  if (activeDays >= 4) {
    notes.push(
      `You showed up on ${activeDays} different days. Consistency, the forgiving kind.`,
    );
  }

  return notes;
}

// ---------------------------------------------------------------------------
// Peak-Focus Nudge (P15) — is now inside the personal peak window?
// ---------------------------------------------------------------------------

/** Total focus sessions needed before we claim a peak pattern. */
export const PEAK_MIN_SESSIONS = 4;

export function focusSessionCount(hours: number[] | undefined | null): number {
  if (!Array.isArray(hours)) return 0;
  return hours.reduce((a, b) => a + (Number(b) || 0), 0);
}

/** Show the nudge for the hour before, of, and after the peak. */
export function isInPeakWindow(nowHour: number, peakHour: number): boolean {
  return Math.abs(nowHour - peakHour) <= 1;
}
