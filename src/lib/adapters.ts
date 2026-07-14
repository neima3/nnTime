/**
 * Data adapters — transform DAL/DB rows into the render shapes the UI
 * components expect (matching the original mock data types in src/lib/mock.ts).
 *
 * This bridges the real data layer and the design-reference screens so the
 * visual quality is preserved while reading from the actual database.
 */

import type { Activity, CategoryId } from "./mock";
import type {
  DbActivitySeries,
  DbTask,
  DbCategory,
} from "@/server/db/schema";

/** Map a category UUID to its semantic key (peach/butter/mint/sky/lilac/rose). */
export function buildCategoryMap(categories: DbCategory[]): Map<string, CategoryId> {
  const map = new Map<string, CategoryId>();
  for (const c of categories) {
    const key = c.key as CategoryId;
    if (["peach", "butter", "mint", "sky", "lilac", "rose"].includes(key)) {
      map.set(c.id, key);
    }
  }
  return map;
}

/**
 * Convert an activity_series row into the Activity render shape.
 * The series' dtstartLocal (a Date) is converted to minutes-from-midnight
 * in the user's planning zone for timeline positioning.
 */
export function seriesToActivity(
  series: DbActivitySeries,
  categoryMap: Map<string, CategoryId>,
  planningZone: string,
  opts: { done?: boolean } = {},
): Activity {
  // Convert the UTC instant to minutes-from-midnight in the planning zone.
  const start = dateToMinutesFromMidnight(series.dtstartLocal, planningZone);

  // Resolve category: look up the categoryId in the map, default to 'sky'.
  const category = series.categoryId
    ? categoryMap.get(series.categoryId) ?? "sky"
    : "sky";

  // Checklist template (jsonb array of {label, done?} or freeform).
  let checklist: Activity["checklist"];
  const tmpl = series.checklistTemplate;
  if (Array.isArray(tmpl) && tmpl.length > 0) {
    checklist = tmpl.map((item) => {
      if (item && typeof item === "object" && "label" in item) {
        const o = item as { label?: unknown; done?: unknown };
        return {
          label: String(o.label ?? ""),
          done: Boolean(o.done),
        };
      }
      return { label: String(item), done: false };
    });
  }

  return {
    id: series.id,
    title: series.title,
    emoji: series.emoji ?? "📋",
    start,
    duration: series.durationMin,
    category,
    energy: series.energy ?? undefined,
    done: opts.done ?? false,
    checklist,
    revision: series.revision,
    categoryId: series.categoryId ?? undefined,
    occurrenceKey: series.dtstartLocal.toISOString(),
    notes: series.notes ?? undefined,
    priority: series.priority,
  };
}

/** Convert a Date to minutes-from-midnight in a given IANA timezone. */
export function dateToMinutesFromMidnight(date: Date, zone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return (hour === 24 ? 0 : hour) * 60 + minute;
}

/**
 * Build a UTC ISO instant for a local wall-clock time on a YYYY-MM-DD date
 * in a given IANA zone. Uses a binary search on offset (same idea as zone.ts)
 * so drag/create lands on the intended day.
 */
export function localMinutesToInstant(
  dateStr: string,
  minutesFromMidnight: number,
  zone: string,
): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const hour = Math.floor(minutesFromMidnight / 60);
  const minute = minutesFromMidnight % 60;
  // Approximate: treat as UTC then adjust by measuring wall clock.
  // Iterate a few times for DST.
  let guess = new Date(Date.UTC(y!, m! - 1, d!, hour, minute, 0));
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(guess);
    const get = (t: string) =>
      Number(parts.find((p) => p.type === t)?.value ?? "0");
    let wh = get("hour");
    if (wh === 24) wh = 0;
    const asUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      wh,
      get("minute"),
      get("second"),
    );
    const target = Date.UTC(y!, m! - 1, d!, hour, minute, 0);
    const delta = target - asUtc;
    if (delta === 0) break;
    guess = new Date(guess.getTime() + delta);
  }
  return guess.toISOString();
}

/**
 * Convert a task row (bucket=anytime) into the inbox render shape.
 */
export function taskToInboxItem(
  task: DbTask,
  categoryMap: Map<string, CategoryId>,
): {
  id: string;
  title: string;
  emoji: string;
  category: CategoryId;
  revision: number;
} {
  const category = task.categoryId
    ? categoryMap.get(task.categoryId) ?? "sky"
    : "sky";
  return {
    id: task.id,
    title: task.title,
    emoji: task.emoji ?? "📋",
    category,
    revision: task.revision,
  };
}
