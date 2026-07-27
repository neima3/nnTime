/**
 * Companion mode (T11 — body doubling) — the presence logic, kept pure.
 *
 * Body doubling is one of the most-requested ADHD supports: working alongside
 * someone makes starting and staying possible. Kairo's companion is honest
 * about what it is — quiet, steady company from the app itself, not a fake
 * human — so the copy never pretends, never coaches, and never checks up on
 * you. It just stays.
 *
 * The line rotates every few minutes, derived from elapsed time (no extra
 * timers — the focus tick already exists). Device-local preference; the
 * "Body double" ritual turns it on for you.
 */

export const COMPANION_KEY = "kairo-companion";

/** Rotate slowly — presence, not chatter. */
export const COMPANION_ROTATE_MIN = 4;

const RUNNING_LINES = [
  "Working alongside you — no rush.",
  "Still here. One thing at a time.",
  "Quiet company while you work.",
  "You're not doing this alone.",
  "Here for the whole thing.",
] as const;

const PAUSED_LINE = "Paused together — take your moment.";
const OVERTIME_LINE = "Still with you — wrap up whenever it feels right.";

export type CompanionState = "running" | "paused" | "overtime";

/**
 * The line to show `elapsedMin` minutes into a session. Deterministic, so a
 * re-render never flickers the copy; rotates every COMPANION_ROTATE_MIN
 * minutes through the running set. Paused and overtime get their own single,
 * steady line.
 */
export function companionLine(elapsedMin: number, state: CompanionState): string {
  if (state === "paused") return PAUSED_LINE;
  if (state === "overtime") return OVERTIME_LINE;
  const step = Math.max(0, Math.floor(elapsedMin / COMPANION_ROTATE_MIN));
  return RUNNING_LINES[step % RUNNING_LINES.length];
}

/** Device preference — remembered across sessions, never synced (it's a vibe,
 *  not data). Storage failures (private mode) fall back to off. */
export function readCompanionPref(): boolean {
  try {
    return localStorage.getItem(COMPANION_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeCompanionPref(on: boolean): void {
  try {
    if (on) localStorage.setItem(COMPANION_KEY, "1");
    else localStorage.removeItem(COMPANION_KEY);
  } catch {}
}
