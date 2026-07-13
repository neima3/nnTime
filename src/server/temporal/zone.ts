/**
 * Timezone helpers — ADR-001 "Instants, zones, dates".
 *
 * Rules (binding):
 *  - Timed instants stored UTC (timestamptz).
 *  - Date-only values (Anytime/all-day) are DATE columns — never midnight UTC.
 *  - `GET /api/v1/day/{YYYY-MM-DD}?tz=<iana>`: tz optional (defaults to the
 *    user's planning zone); response echoes the zone and resolved UTC bounds
 *    `[start, end)` (exclusive end).
 *  - DST handling: nonexistent local times (spring-forward gap) shift forward
 *    to the first valid instant; ambiguous times (fall-back fold) take the
 *    FIRST occurrence.
 *
 * Validation uses Intl.DateTimeFormat as the source of truth (it accepts
 * canonical names like Asia/Kolkata that Intl.supportedValuesOf omits).
 */

/** Format loose zone-format check (the Intl probe is the real validator). */
const IANA_ZONE_RE = /^[A-Za-z][A-Za-z0-9_+\-/]*(\/[A-Za-z0-9_+\-/]+)*$/;

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    dtfCache.set(tz, f);
  }
  return f;
}

function acceptsZone(tz: string): boolean {
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

/** Validate an IANA timezone string. Throws on invalid. */
export function assertValidZone(tz: string): void {
  if (!IANA_ZONE_RE.test(tz) || !acceptsZone(tz)) {
    throw new RangeError(`Invalid IANA timezone: ${tz}`);
  }
}

export function isValidZone(tz: string): boolean {
  try {
    assertValidZone(tz);
    return true;
  } catch {
    return false;
  }
}

/** Project a UTC instant into wall-clock fields for `tz`. */
function wallClock(instant: Date, tz: string) {
  const parts = formatter(tz).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0; // some locales emit 24 for midnight
  return {
    year: Number(get("year")),
    month: Number(get("month")) - 1,
    day: Number(get("day")),
    hour,
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

/**
 * The UTC offset (ms) of `tz` at the given instant. Positive = ahead of UTC.
 */
export function offsetMillisAt(tz: string, instant: Date): number {
  const wc = wallClock(instant, tz);
  const asIfUtc = Date.UTC(
    wc.year,
    wc.month,
    wc.day,
    wc.hour,
    wc.minute,
    wc.second,
  );
  return asIfUtc - instant.getTime();
}

const MS_HOUR = 3_600_000;

/**
 * Convert wall-clock fields in `tz` to a UTC instant.
 *
 * DST gap (spring-forward): if the local time does not exist, shift forward
 * by the transition magnitude to the first valid instant (ADR-001). E.g.
 * 02:30 on a 02:00→03:00 spring-forward day becomes 03:30.
 *
 * DST fold (fall-back): if the local time occurs twice, take the FIRST
 * occurrence (earlier UTC instant = still-DST larger offset) unless
 * foldPreference === "second".
 *
 * Algorithm: probe the offset across a ±13h window around the naive guess (a
 * DST transition can sit up to 12h from the naive instant in the worst case),
 * collect each distinct offset-adjusted candidate, then keep the candidates
 * whose wall-clock projection exactly matches the target. This reliably finds
 * both occurrences in a fold and detects a gap (zero matches).
 */
export function wallClockToInstant(
  year: number,
  month: number, // 0-indexed
  day: number,
  hour: number,
  minute: number,
  second: number,
  tz: string,
  foldPreference: "first" | "second" = "first",
): Date {
  assertValidZone(tz);
  const targetWallUtc = Date.UTC(year, month, day, hour, minute, second);

  // Collect distinct offset-adjusted candidates by probing a wide window.
  const seenOffsets = new Set<number>();
  const candidates: number[] = [];
  for (let deltaH = -13; deltaH <= 13; deltaH++) {
    const probe = targetWallUtc + deltaH * MS_HOUR;
    const off = offsetMillisAt(tz, new Date(probe));
    if (!seenOffsets.has(off)) {
      seenOffsets.add(off);
      candidates.push(targetWallUtc - off);
    }
  }

  const matches = candidates.filter((t) => {
    const wc = wallClock(new Date(t), tz);
    return (
      wc.year === year &&
      wc.month === month &&
      wc.day === day &&
      wc.hour === hour &&
      wc.minute === minute &&
      wc.second === second
    );
  });

  if (matches.length === 1) {
    return new Date(matches[0]);
  }
  if (matches.length >= 2) {
    // Fold: two instants project to the same wall time. Sort ascending so
    // [0] is the earlier (first) occurrence and [1] is the later (second).
    matches.sort((a, b) => a - b);
    return new Date(foldPreference === "first" ? matches[0] : matches[1]);
  }

  // No match → the wall time is in a gap (spring-forward). Per ADR-001, shift
  // forward to the first valid instant = the target wall time advanced by the
  // gap duration, in the post-transition offset. Walk forward in real time
  // from the naive guess; the first instant whose wall-clock matches the
  // target-shifted-by-gap (e.g. 02:30 → 03:30) is the answer.
  const sortedOffsets = [...seenOffsets].sort((a, b) => b - a); // descending
  const gapMagnitude =
    Math.abs(sortedOffsets[0] - sortedOffsets[sortedOffsets.length - 1]) || MS_HOUR;
  // Walk forward; the post-transition wall clock starts right after the gap.
  // Find the first instant whose projected wall time == target + gapMagnitude.
  const targetShiftedWall = targetWallUtc + gapMagnitude;
  let probe = targetWallUtc;
  for (let i = 0; i < 600; i++) {
    const wc2 = wallClock(new Date(probe), tz);
    const wcUtc = Date.UTC(
      wc2.year,
      wc2.month,
      wc2.day,
      wc2.hour,
      wc2.minute,
      wc2.second,
    );
    if (wcUtc === targetShiftedWall) {
      return new Date(probe);
    }
    if (wcUtc > targetShiftedWall) break; // overshot
    probe += 60_000;
  }
  // Fallback: first instant whose wall time is >= target (gap start).
  probe = targetWallUtc;
  for (let i = 0; i < 600; i++) {
    const w = wallClock(new Date(probe), tz);
    if (
      w.year === year &&
      w.month === month &&
      w.day === day &&
      (w.hour > hour || (w.hour === hour && w.minute >= minute))
    ) {
      return new Date(probe);
    }
    probe += 60_000;
  }
  return new Date(targetWallUtc);
}

/**
 * Resolve the UTC bounds `[start, end)` for a calendar date in a zone.
 * `dateStr` is `YYYY-MM-DD`. Start = local midnight (first occurrence if
 * folded); end = next local midnight. The span is a whole number of UTC hours
 * (23/24/25 across DST).
 */
export function resolveDayBounds(
  dateStr: string,
  tz: string,
): { start: Date; end: Date; zone: string } {
  assertValidZone(tz);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) throw new RangeError(`date must be YYYY-MM-DD, got: ${dateStr}`);
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);

  const start = wallClockToInstant(year, month, day, 0, 0, 0, tz, "first");
  const next = new Date(Date.UTC(year, month, day + 1));
  const end = wallClockToInstant(
    next.getUTCFullYear(),
    next.getUTCMonth(),
    next.getUTCDate(),
    0,
    0,
    0,
    tz,
    "first",
  );

  return { start, end, zone: tz };
}

/**
 * Format a UTC instant as `YYYY-MM-DD` in a zone (the calendar date a user in
 * `tz` sees). Used for bucketing activities into the right day.
 */
export function instantToDateStr(instant: Date, tz: string): string {
  assertValidZone(tz);
  // en-CA produces YYYY-MM-DD natively.
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(instant);
}
