/**
 * Quiet hours (H7) — the one place that decides "is this a resting hour?".
 *
 * The window lives in `settings.notificationPrefs.quietHours` so it syncs across
 * web and iOS. Server-side push delivery, the web Settings toggle, and the iOS
 * reminder scheduler all reason about the same shape, so the wrap-around and
 * fallback rules are extracted here instead of being re-derived per caller.
 *
 * Pure module: no DOM, no db, no env. Safe to import from anywhere.
 */

export interface QuietHours {
  enabled: boolean;
  /** Hour the window opens, 0–23, inclusive. */
  start: number;
  /** Hour the window closes, 0–23, exclusive. */
  end: number;
}

/** Rest overnight by default — matches the iOS default (22:00–07:00). */
export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  start: 22,
  end: 7,
};

function normalizeHour(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const h = Math.floor(value);
  if (h < 0 || h > 23) return fallback;
  return h;
}

/**
 * Read the quiet-hours window out of a `notificationPrefs` blob. Anything
 * malformed (missing, wrong type, out-of-range hours) falls back to the default
 * rather than throwing — prefs are a free-form jsonb column shared with iOS, so
 * a bad value must never break notification delivery.
 */
export function parseQuietHours(prefs: unknown): QuietHours {
  if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) {
    return { ...DEFAULT_QUIET_HOURS };
  }
  const raw = (prefs as Record<string, unknown>).quietHours;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_QUIET_HOURS };
  }
  const q = raw as Record<string, unknown>;
  return {
    enabled: q.enabled === true,
    start: normalizeHour(q.start, DEFAULT_QUIET_HOURS.start),
    end: normalizeHour(q.end, DEFAULT_QUIET_HOURS.end),
  };
}

/**
 * Is `hour` inside the window? Overnight-wrap aware (22→7 covers 22, 23, 0…6).
 * A zero-length window (start === end) is treated as "no quiet hours" — never as
 * "quiet all day", so a mis-set window can't silence every reminder forever.
 */
export function inQuietHours(hour: number, qh: QuietHours): boolean {
  if (!qh.enabled) return false;
  const h = normalizeHour(hour, -1);
  if (h < 0) return false;
  if (qh.start === qh.end) return false;
  return qh.start < qh.end
    ? h >= qh.start && h < qh.end
    : h >= qh.start || h < qh.end;
}

/** Convenience for callers holding a raw prefs blob (server push path). */
export function isQuietAt(prefs: unknown, hour: number): boolean {
  return inQuietHours(hour, parseQuietHours(prefs));
}

/** Merge a window back into a prefs blob, leaving every other key untouched. */
export function writeQuietHours(
  prefs: Record<string, unknown> | null | undefined,
  qh: QuietHours,
): Record<string, unknown> {
  return {
    ...(prefs ?? {}),
    quietHours: {
      enabled: qh.enabled,
      start: normalizeHour(qh.start, DEFAULT_QUIET_HOURS.start),
      end: normalizeHour(qh.end, DEFAULT_QUIET_HOURS.end),
    },
  };
}

/** How many hours the window covers (0 when disabled or zero-length). */
export function quietWindowHours(qh: QuietHours): number {
  if (!qh.enabled || qh.start === qh.end) return 0;
  return qh.start < qh.end ? qh.end - qh.start : 24 - qh.start + qh.end;
}

/** "10 PM" / "22:00" — for hints and labels, respecting the user's hour cycle. */
export function formatQuietHour(hour: number, hourCycle: "h12" | "h24"): string {
  const h = normalizeHour(hour, 0);
  if (hourCycle === "h24") return `${String(h).padStart(2, "0")}:00`;
  const suffix = h < 12 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${suffix}`;
}

/** Human sentence for the settings row / iOS hint. */
export function describeQuietHours(
  qh: QuietHours,
  hourCycle: "h12" | "h24" = "h12",
): string {
  if (!qh.enabled || quietWindowHours(qh) === 0) {
    return "Reminders can arrive any time";
  }
  return `No reminders ${formatQuietHour(qh.start, hourCycle)}–${formatQuietHour(
    qh.end,
    hourCycle,
  )} — rest undisturbed`;
}
