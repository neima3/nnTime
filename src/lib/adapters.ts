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
): Activity {
  // Convert the UTC instant to minutes-from-midnight in the planning zone.
  const start = dateToMinutesFromMidnight(series.dtstartLocal, planningZone);

  // Resolve category: look up the categoryId in the map, default to 'sky'.
  const category = series.categoryId
    ? categoryMap.get(series.categoryId) ?? "sky"
    : "sky";

  return {
    id: series.id,
    title: series.title,
    emoji: series.emoji ?? "📋",
    start,
    duration: series.durationMin,
    category,
    energy: series.energy ?? undefined,
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
 * Convert a task row (bucket=anytime) into the inbox render shape.
 */
export function taskToInboxItem(
  task: DbTask,
  categoryMap: Map<string, CategoryId>,
): { id: string; title: string; emoji: string; category: CategoryId } {
  const category = task.categoryId
    ? categoryMap.get(task.categoryId) ?? "sky"
    : "sky";
  return {
    id: task.id,
    title: task.title,
    emoji: task.emoji ?? "📋",
    category,
  };
}
