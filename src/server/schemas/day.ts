/**
 * Day snapshot schemas.
 *
 * ADR-001: GET /api/v1/day/{YYYY-MM-DD}?tz=<iana> returns the resolved day for
 * rendering (NOT for sync — use GET /changes). The response echoes the zone and
 * the resolved UTC bounds [start, end) (exclusive end), plus the activities and
 * anytime tasks that fall in that window. Checked for drift against
 * api/openapi.yaml in CI.
 */

import { z } from "zod";
import {
  dateStr,
  ianaTimezone,
  instant,
  occurrenceStatusEnum,
  uuid,
} from "./common";
import { activitySeriesResponse } from "./activity-series";
import { taskResponse } from "./task";

/** Series response fields resolved for one occurrence in the requested day. */
export const dayActivityResponse = activitySeriesResponse.extend({
  /** Stable identity of this expanded occurrence. */
  occurrenceKey: instant,
  /** Effective occurrence status after applying any override. */
  status: occurrenceStatusEnum,
});

/** GET /api/v1/day/{date} response body. */
export const dayResponse = z.object({
  /** The date requested (YYYY-MM-DD). */
  date: dateStr,
  /** IANA zone used to resolve the day (echoed; defaults to the user's zone). */
  zone: ianaTimezone,
  /** Inclusive UTC start of the resolved day. */
  start: instant,
  /** Exclusive UTC end of the resolved day ([start, end)). */
  end: instant,
  /** Series-shaped activities resolved into occurrences overlapping [start, end). */
  activities: z.array(dayActivityResponse),
  /** Anytime tasks attached to this date. */
  anytimeTasks: z.array(taskResponse),
  /** Compatibility map from series id to its resolved occurrence status. */
  occurrenceStatusBySeries: z.record(uuid, occurrenceStatusEnum),
});

export type DayActivityResponse = z.infer<typeof dayActivityResponse>;
export type DayResponse = z.infer<typeof dayResponse>;
