/**
 * Recurrence expansion — ADR-001 "Recurrence model".
 *
 * Expands a series RRULE in WALL-CLOCK time in the series `tz`, then converts
 * to instants. DST rules (gap/fold) handled by zone.ts. This is the pure
 * expansion engine; the "this / this-and-future / all" edit-scope transactions
 * and occurrence materialization live in Phase 2A.
 *
 * RRULE subset supported (deliberately small, hand-parsed — no rrule lib):
 *  - FREQ=DAILY|WEEKLY|MONTHLY
 *  - INTERVAL=N  (custom N-day/week intervals — deliberate Tiimo-beating feature)
 *  - COUNT=N | UNTIL=YYYYMMDDThhmmssZ
 *  - BYDAY=MO,TU,... (WEEKLY only)
 *  - EXDATE / RDATE applied via the series row, not the rrule string
 *
 * `occurrence_key` = the ORIGINAL local start instant (stable identity that
 * survives "this and future" series splits — the split creates a new series but
 * the occurrence_key moves with the occurrence).
 */

import { wallClockToInstant } from "./zone";

export type Freq = "DAILY" | "WEEKLY" | "MONTHLY";

export interface ParsedRrule {
  freq: Freq;
  interval: number; // >0, default 1
  count?: number;
  until?: Date; // UTC instant (inclusive)
  byDay?: string[]; // MO,TU,WE,TH,FR,SA,SU
}

const DAY_TO_IDX: Record<string, number> = {
  MO: 0,
  TU: 1,
  WE: 2,
  TH: 3,
  FR: 4,
  SA: 5,
  SU: 6,
};

/** Parse an RRULE string into a validated structure. Throws on unsupported. */
export function parseRrule(rrule: string): ParsedRrule {
  const parts = rrule.trim().toUpperCase().split(";");
  const map: Record<string, string> = {};
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (!k || v === undefined) throw new Error(`bad RRULE segment: ${p}`);
    map[k] = v;
  }
  if (map.RRULE !== undefined) {
    // Some inputs arrive as "RRULE:FREQ=..."; handle gracefully.
    return parseRrule(rrule.replace(/^RRULE:/i, ""));
  }
  const freq = map.FREQ as Freq;
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY") {
    throw new Error(`unsupported FREQ: ${map.FREQ ?? "(missing)"}`);
  }
  const interval = map.INTERVAL ? Number(map.INTERVAL) : 1;
  if (!Number.isInteger(interval) || interval < 1) {
    throw new Error(`bad INTERVAL: ${map.INTERVAL}`);
  }
  let count: number | undefined;
  if (map.COUNT !== undefined) {
    count = Number(map.COUNT);
    if (!Number.isInteger(count) || count < 1) throw new Error(`bad COUNT`);
  }
  let until: Date | undefined;
  if (map.UNTIL !== undefined) {
    // YYYYMMDDThhmmssZ
    const u = map.UNTIL;
    const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(u);
    if (!m) throw new Error(`bad UNTIL: ${u}`);
    until = new Date(
      Date.UTC(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4]),
        Number(m[5]),
        Number(m[6]),
      ),
    );
  }
  let byDay: string[] | undefined;
  if (map.BYDAY !== undefined) {
    byDay = map.BYDAY.split(",").map((d) => {
      if (!(d in DAY_TO_IDX)) throw new Error(`bad BYDAY value: ${d}`);
      return d;
    });
    if (freq !== "WEEKLY") {
      throw new Error(`BYDAY only supported with FREQ=WEEKLY`);
    }
  }
  return { freq, interval, count, until, byDay };
}

export interface Occurrence {
  /** Stable identity = the original local start instant (UTC representation). */
  occurrenceKey: Date;
  /** The actual start instant (may differ from key only for overridden rows). */
  startAt: Date;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

function addMonths(year: number, month: number, day: number, months: number) {
  const totalMonths = year * 12 + month + months;
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  // Clamp day for short months (month-end recurrence — ADR-001 test scenario).
  // Jan 31 monthly → Feb 28/29. We clamp rather than overflow.
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  return { year: y, month: m, day: clampedDay };
}

/**
 * Expand a recurrence series into occurrences between `from` and `to` (UTC
 * instants, inclusive of start, exclusive of end). `dtstartLocalFields` are the
 * wall-clock fields (year, month0, day, hour, min, sec) of the series start in
 * the series zone.
 *
 * Limits: a hard cap (`maxOccurrences`, default 500) prevents runaway expansion.
 */
export function expandSeries(args: {
  rrule: string | null;
  tz: string;
  dtstart: { year: number; month: number; day: number; hour: number; minute: number; second: number };
  from: Date;
  to: Date;
  exdates?: Date[]; // occurrence keys to skip
  rdates?: Date[]; // extra occurrence keys to include
  maxOccurrences?: number;
  durationMin: number;
}): Occurrence[] {
  const {
    tz,
    dtstart,
    from,
    to,
    exdates,
    rdates,
    maxOccurrences = 500,
    durationMin,
  } = args;

  // Helper: wall-clock fields → Occurrence (using DST-safe conversion).
  const toOcc = (
    y: number,
    mo: number,
    d: number,
    h: number,
    mi: number,
    s: number,
  ): Occurrence => {
    const start = wallClockToInstant(y, mo, d, h, mi, s, tz, "first");
    return { occurrenceKey: start, startAt: start };
  };

  const results: Occurrence[] = [];
  const seenKeys = new Set<number>();

  const pushIfInWindow = (occ: Occurrence) => {
    if (occ.startAt.getTime() >= to.getTime()) return false;
    if (occ.startAt.getTime() + durationMin * 60000 <= from.getTime()) return true; // past window, keep scanning
    const key = occ.occurrenceKey.getTime();
    if (exdates?.some((e) => e.getTime() === key)) return true;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      results.push(occ);
    }
    return true;
  };

  if (!args.rrule) {
    // One-off: single occurrence at dtstart.
    const occ = toOcc(
      dtstart.year,
      dtstart.month,
      dtstart.day,
      dtstart.hour,
      dtstart.minute,
      dtstart.second,
    );
    pushIfInWindow(occ);
  } else {
    const rule = parseRrule(args.rrule);
    let emitted = 0;
    const stop = () =>
      (rule.count !== undefined && emitted >= rule.count) ||
      emitted >= maxOccurrences;

    if (rule.freq === "DAILY") {
      let y = dtstart.year,
        mo = dtstart.month,
        d = dtstart.day;
      let n = 0;
      while (!stop()) {
        const occ = toOcc(y, mo, d, dtstart.hour, dtstart.minute, dtstart.second);
        if (rule.until && occ.startAt.getTime() > rule.until.getTime()) break;
        if (occ.startAt.getTime() >= to.getTime()) break;
        if (pushIfInWindow(occ)) {
          emitted++;
        } else if (occ.startAt.getTime() >= to.getTime()) break;
        // advance by interval days
        const next = addDays(
          new Date(Date.UTC(y, mo, d)),
          rule.interval,
        );
        y = next.getUTCFullYear();
        mo = next.getUTCMonth();
        d = next.getUTCDate();
        n++;
        if (n > maxOccurrences * 2) break;
      }
    } else if (rule.freq === "WEEKLY") {
      // Start week from dtstart; iterate week by week.
      const startDayIdx = new Date(
        Date.UTC(dtstart.year, dtstart.month, dtstart.day),
      ).getUTCDay(); // 0=Sun
      const mondayIdx = (startDayIdx + 6) % 7; // 0=Mon, days since Monday
      // DAY_TO_IDX is Monday-based (MO=0..SU=6). When no BYDAY, the only day is
      // dtstart's weekday (converted to Monday-based).
      const monOffsets = rule.byDay
        ? rule.byDay
            .map((d) => DAY_TO_IDX[d])
            .sort((a, b) => a - b)
        : [mondayIdx];
      let weekStartDate = new Date(
        Date.UTC(dtstart.year, dtstart.month, dtstart.day - mondayIdx),
      );
      let weekCount = 0;
      while (!stop()) {
        let anyInFuture = false;
        for (const off of monOffsets) {
          const dayDate = addDays(weekStartDate, off);
          const occ = toOcc(
            dayDate.getUTCFullYear(),
            dayDate.getUTCMonth(),
            dayDate.getUTCDate(),
            dtstart.hour,
            dtstart.minute,
            dtstart.second,
          );
          if (occ.startAt.getTime() < from.getTime()) continue;
          if (occ.startAt.getTime() >= to.getTime()) {
            anyInFuture = true;
            continue;
          }
          if (rule.until && occ.startAt.getTime() > rule.until.getTime()) {
            anyInFuture = true;
            continue;
          }
          // Don't emit before dtstart
          const dtstartInstant = wallClockToInstant(
            dtstart.year,
            dtstart.month,
            dtstart.day,
            dtstart.hour,
            dtstart.minute,
            dtstart.second,
            tz,
            "first",
          );
          if (occ.startAt.getTime() < dtstartInstant.getTime()) continue;
          if (pushIfInWindow(occ)) emitted++;
          if (stop()) break;
        }
        if (anyInFuture) break;
        weekStartDate = addDays(weekStartDate, 7 * rule.interval);
        weekCount++;
        if (weekCount > maxOccurrences * 2) break;
      }
    } else {
      // MONTHLY
      let m = 0;
      while (!stop()) {
        const { year: y, month: mo, day: d } = addMonths(
          dtstart.year,
          dtstart.month,
          dtstart.day,
          m * rule.interval,
        );
        const occ = toOcc(y, mo, d, dtstart.hour, dtstart.minute, dtstart.second);
        if (rule.until && occ.startAt.getTime() > rule.until.getTime()) break;
        if (occ.startAt.getTime() >= to.getTime()) break;
        const dtstartInstant = wallClockToInstant(
          dtstart.year,
          dtstart.month,
          dtstart.day,
          dtstart.hour,
          dtstart.minute,
          dtstart.second,
          tz,
          "first",
        );
        if (occ.startAt.getTime() >= dtstartInstant.getTime()) {
          if (pushIfInWindow(occ)) emitted++;
        }
        m++;
        if (m > maxOccurrences * 2) break;
      }
    }
  }

  // Add RDATEs (extra occurrences).
  if (rdates) {
    for (const r of rdates) {
      const key = r.getTime();
      if (key >= from.getTime() && key < to.getTime() && !seenKeys.has(key)) {
        results.push({ occurrenceKey: r, startAt: r });
        seenKeys.add(key);
      }
    }
  }

  results.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  return results;
}

/**
 * Derive the stable occurrence_key for a given occurrence index of a series.
 * Used when materializing or referencing an occurrence without expanding.
 *
 * For "this and future" series splits (Phase 2A), the occurrence_key MUST be
 * preserved — this function is the canonical way to compute it so the identity
 * is stable across the old and new series.
 */
export function occurrenceKeyForIndex(
  dtstart: { year: number; month: number; day: number; hour: number; minute: number; second: number },
  tz: string,
  rrule: string | null,
  index: number,
): Date {
  if (index === 0) {
    return wallClockToInstant(
      dtstart.year,
      dtstart.month,
      dtstart.day,
      dtstart.hour,
      dtstart.minute,
      dtstart.second,
      tz,
      "first",
    );
  }
  // For non-zero index, expand and pick. Inefficient but correct; only used for
  // ad-hoc lookups, not bulk materialization.
  const all = expandSeries({
    rrule,
    tz,
    dtstart,
    from: new Date(-8640000000000000),
    to: new Date(8640000000000000),
    durationMin: 1,
  });
  return all[index]?.occurrenceKey ?? all[0].occurrenceKey;
}
