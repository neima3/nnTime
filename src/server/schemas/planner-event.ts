/**
 * Planner event resource schemas.
 *
 * Mirrors the `planner_events` table in src/server/db/schema.ts (ADR-001
 * append-only history). Streaks and stats read ONLY this table. Note:
 * planner_events has no revision/updated/deletedAt columns — it is append-only
 * with a single `occurredAt`. Checked for drift against api/openapi.yaml in CI.
 */

import { z } from "zod";
import {
  ianaTimezone,
  instant,
  jsonObject,
  plannerEventTypeEnum,
  uuid,
} from "./common";

/** Planner event response body (an entry in the append-only history). */
export const plannerEventResponse = z.object({
  id: uuid,
  userId: uuid,
  /** Free-text entity type (e.g. "task", "activity_occurrence"). */
  entityType: z.string(),
  entityId: uuid,
  eventType: plannerEventTypeEnum,
  /** Structured event payload (jsonb). */
  payload: jsonObject,
  /** When the event logically occurred (per ADR-001 ordering). */
  occurredAt: instant,
  /** IANA zone in which occurredAt was recorded. */
  tz: ianaTimezone,
  createdAt: instant,
});

export type PlannerEventResponse = z.infer<typeof plannerEventResponse>;
