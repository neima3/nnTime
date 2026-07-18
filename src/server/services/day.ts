/**
 * Server-side day resolution service — shared by Server Components and
 * GET /api/v1/day/{date}. ADR-002: same code path, never self-HTTP.
 *
 * Reads the authenticated user's settings, resolves the day in their planning
 * zone, expands recurring series into that day, and merges occurrence overrides.
 */
import "server-only";
import { getSession } from "../auth-session";
import {
  getOrCreateSettings,
  listTasks,
  listActivitySeries,
  listUserOccurrences,
  type Db,
} from "../dal";
import {
  resolveDayBounds,
  instantToDateStr,
  instantToWallFields,
  wallClockToInstant,
} from "../temporal/zone";
import { expandSeries } from "../temporal/recurrence";
import type {
  DbActivityOccurrence,
  DbActivitySeries,
} from "../db/schema";

/** Series-shaped activity for a single expanded occurrence on a day. */
export type ResolvedDayActivity = DbActivitySeries & {
  /** Stable occurrence identity (original local start). */
  occurrenceKey: Date;
  /** Occurrence status (pending if no override row). */
  status: "pending" | "completed" | "skipped" | "cancelled";
};

export interface ResolvedDay {
  userId: string;
  date: string;
  zone: string;
  start: Date;
  end: Date;
  activities: ResolvedDayActivity[];
  anytimeTasks: unknown[];
  /**
   * seriesId → occurrence status for this day's occurrence (compat).
   * Prefer `activities[i].status` + `occurrenceKey` when multiple instances
   * of one series can land on the same day.
   */
  occurrenceStatusBySeries: Record<string, string>;
}

/** Minimal series fields needed for pure expansion (test-friendly). */
export type ExpandableSeries = Pick<
  DbActivitySeries,
  | "id"
  | "tz"
  | "dtstartLocal"
  | "rrule"
  | "exdate"
  | "rdate"
  | "title"
  | "durationMin"
  | "energy"
  | "checklistTemplate"
  | "deletedAt"
> &
  Partial<DbActivitySeries>;

/** Minimal occurrence override fields for pure expansion. */
export type ExpandableOccurrence = Pick<
  DbActivityOccurrence,
  "seriesId" | "occurrenceKey" | "status"
> &
  Partial<
    Pick<
      DbActivityOccurrence,
      | "title"
      | "startAt"
      | "durationMin"
      | "energy"
      | "checklistOverride"
      | "deletedAt"
    >
  >;

/**
 * Convert series EXDATE date-only values into occurrence-key instants at the
 * series wall-clock time (hour/min/sec) in the series zone.
 */
function exdatesToOccurrenceKeys(
  exdates: Date[] | null | undefined,
  dtstart: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  },
  tz: string,
): Date[] {
  if (!exdates?.length) return [];
  return exdates.map((d) => {
    // date({ mode: "date" }) → midnight UTC for the calendar date.
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const day = d.getUTCDate();
    return wallClockToInstant(
      y,
      m,
      day,
      dtstart.hour,
      dtstart.minute,
      dtstart.second,
      tz,
      "first",
    );
  });
}

/**
 * Pure: expand all non-deleted series into activity rows for a day window.
 * Unit-testable without DB/auth.
 *
 * @param seriesList - activity_series rows (already non-deleted preferred)
 * @param occurrences - occurrence override rows for the user
 * @param bounds - `[start, end)` UTC instants for the target day
 */
export function expandActivitiesForDay(
  seriesList: ExpandableSeries[],
  occurrences: ExpandableOccurrence[],
  bounds: { start: Date; end: Date },
): ResolvedDayActivity[] {
  const overrideByKey = new Map<string, ExpandableOccurrence>();
  for (const occ of occurrences) {
    if (occ.deletedAt) continue;
    const key = `${occ.seriesId}|${occ.occurrenceKey.getTime()}`;
    overrideByKey.set(key, occ);
  }

  const activities: ResolvedDayActivity[] = [];

  for (const series of seriesList) {
    if (series.deletedAt) continue;

    const tz = series.tz || "UTC";
    let dtstart: {
      year: number;
      month: number;
      day: number;
      hour: number;
      minute: number;
      second: number;
    };
    try {
      dtstart = instantToWallFields(series.dtstartLocal, tz);
    } catch {
      // Invalid zone — fall back to UTC wall fields so expansion still runs.
      dtstart = instantToWallFields(series.dtstartLocal, "UTC");
    }

    const exdates = exdatesToOccurrenceKeys(series.exdate, dtstart, tz);
    const rdates = series.rdate?.filter(Boolean) ?? undefined;

    let expanded;
    try {
      expanded = expandSeries({
        rrule: series.rrule,
        tz,
        dtstart,
        from: bounds.start,
        to: bounds.end,
        durationMin: series.durationMin,
        exdates: exdates.length ? exdates : undefined,
        rdates,
      });
    } catch {
      // Bad RRULE / zone — skip series rather than failing the whole day.
      continue;
    }

    for (const occ of expanded) {
      const mapKey = `${series.id}|${occ.occurrenceKey.getTime()}`;
      const override = overrideByKey.get(mapKey);
      const status = (override?.status ?? "pending") as ResolvedDayActivity["status"];

      // Cancelled / skipped instances are not shown on the day timeline.
      if (status === "cancelled" || status === "skipped") continue;

      const checklistTemplate =
        override?.checklistOverride != null &&
        Array.isArray(override.checklistOverride)
          ? override.checklistOverride
          : series.checklistTemplate;

      activities.push({
        ...(series as DbActivitySeries),
        dtstartLocal: override?.startAt ?? occ.startAt,
        durationMin: override?.durationMin ?? series.durationMin,
        title: override?.title ?? series.title,
        energy: override?.energy ?? series.energy,
        checklistTemplate: checklistTemplate ?? series.checklistTemplate,
        occurrenceKey: occ.occurrenceKey,
        status,
      });
    }
  }

  activities.sort(
    (a, b) => a.dtstartLocal.getTime() - b.dtstartLocal.getTime(),
  );
  return activities;
}

/**
 * Resolve today (or a specific date) for the authenticated user. Returns null
 * if not authenticated (the Server Component renders a logged-out state).
 */
export async function getResolvedDay(
  dateStr?: string,
  opts: { db?: Db; tzOverride?: string } = {},
): Promise<ResolvedDay | null> {
  const session = await getSession();
  if (!session) return null;

  const settings = await getOrCreateSettings(session.userId, opts);
  // Allow caller-provided tz override (e.g. ?tz= from the API); otherwise use
  // the user's planning zone from settings.
  const zone = opts.tzOverride || settings.timezone;
  // Prefer the caller's date; otherwise use "today" in the planning zone.
  const target = dateStr ?? instantToDateStr(new Date(), zone);

  const bounds = resolveDayBounds(target, zone);

  const series = await listActivitySeries(session.userId, opts);
  const anytimeTasks = await listTasks(session.userId, {
    bucket: "anytime",
    ...opts,
  });
  const occurrences = await listUserOccurrences(session.userId, opts);

  const activities = expandActivitiesForDay(series, occurrences, bounds);

  const occurrenceStatusBySeries: Record<string, string> = {};
  for (const act of activities) {
    occurrenceStatusBySeries[act.id] = act.status;
  }

  // Anytime tasks: bucket anytime with matching date OR null date (floating).
  const dayAnytime = anytimeTasks.filter((t) => {
    if (!t.date) return true;
    // date column is date-only
    const d =
      t.date instanceof Date
        ? t.date.toISOString().slice(0, 10)
        : String(t.date).slice(0, 10);
    return d === target;
  });

  return {
    userId: session.userId,
    date: target,
    zone,
    start: bounds.start,
    end: bounds.end,
    activities,
    anytimeTasks: dayAnytime,
    occurrenceStatusBySeries,
  };
}
