/**
 * Stats and mood wire contracts.
 *
 * These schemas are shared by the route handlers and api/openapi.yaml under
 * ADR-002. Stats are derived from planner_events; mood check-ins append one.
 */
import { z } from "zod";
import { dateStr, instant } from "./common";

const count = z.number().int().nonnegative();
const hour = z.number().int().min(0).max(23);
const hourVector = z.array(count).length(24);

export const moodEnum = z.enum(["low", "okay", "good", "great"]);

export const statsQuery = z.object({
  days: z.coerce.number().int().min(1).max(90).default(14),
});

const dayStat = z.object({
  completed: count,
  focusMin: count,
  mood: moodEnum.nullable(),
});

const estimate = z.object({
  sessions: count,
  avgTargetMin: count,
  avgActualMin: count,
  ratio: z.number().nonnegative(),
});

const focusHours = z.object({
  hours: hourVector,
  peakHour: hour,
});

const energyPattern = z.object({
  byHour: hourVector,
  sampled: count,
  window: z
    .object({
      start: hour,
      end: hour,
    })
    .nullable(),
});

export const statsResponse = z.object({
  byDate: z.record(dateStr, dayStat),
  streak: z.object({
    current: count,
    best: count,
  }),
  energyBalance: z.object({
    low: count,
    medium: count,
    high: count,
  }),
  totalCompleted: count,
  totalFocusMin: count,
  estimate: estimate.nullable(),
  focusHours: focusHours.nullable(),
  energyPattern,
  from: instant,
  to: instant,
  days: z.number().int().min(1).max(90),
});

export const moodCheckinRequest = z.object({
  mood: moodEnum,
  note: z.string().max(500).optional(),
});

export const moodCheckinResponse = z.object({
  ok: z.literal(true),
});

export type StatsQuery = z.infer<typeof statsQuery>;
export type StatsResponse = z.infer<typeof statsResponse>;
export type MoodCheckinRequest = z.infer<typeof moodCheckinRequest>;
export type MoodCheckinResponse = z.infer<typeof moodCheckinResponse>;
