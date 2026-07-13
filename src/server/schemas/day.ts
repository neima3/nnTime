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
} from "./common";
import { activityOccurrenceResponse } from "./activity-occurrence";
import { taskResponse } from "./task";

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
  /** Activity occurrences overlapping [start, end). */
  activities: z.array(activityOccurrenceResponse),
  /** Anytime tasks attached to this date. */
  anytimeTasks: z.array(taskResponse),
});

export type DayResponse = z.infer<typeof dayResponse>;
