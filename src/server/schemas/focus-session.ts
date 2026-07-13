/**
 * Focus session resource schemas.
 *
 * Mirrors the `focus_sessions` table in src/server/db/schema.ts (ADR-004 —
 * schema only this phase; state-machine logic in 3A). Server-authoritative:
 * clients never merge focus sessions. Note: focus_sessions has no deletedAt
 * tombstone column. Checked for drift against api/openapi.yaml in CI.
 */

import { z } from "zod";
import {
  focusStateEnum,
  instant,
  managedRowFields,
  uuid,
} from "./common";

/** Focus session response body. */
export const focusSessionResponse = z.object({
  ...managedRowFields,
  userId: uuid,
  /** Nullable for ad-hoc sessions not tied to an occurrence. */
  activityOccurrenceId: uuid.nullable(),
  state: focusStateEnum,
  startedAt: instant,
  targetDurationMin: z.number().int(),
  accumulatedPauseSec: z.number().int(),
  /** When the current running/paused interval began; null when idle. */
  currentIntervalStartedAt: instant.nullable(),
  /** Free-text reason captured on completion (e.g. "finished", "interrupted"). */
  completionReason: z.string().nullable(),
});

/** POST /api/v1/focus-sessions body. */
export const focusSessionCreate = z.object({
  activityOccurrenceId: uuid.nullish(),
  targetDurationMin: z.number().int(),
  /** RFC 3339 instant the session started. */
  startedAt: instant,
});

/**
 * Body for a focus-session transition
 * (POST /api/v1/focus-sessions/{id}/transitions or PATCH /state). `state` is
 * the target focus state per ADR-004's machine.
 */
export const focusSessionTransition = z.object({
  state: focusStateEnum,
});

export type FocusSessionResponse = z.infer<typeof focusSessionResponse>;
export type FocusSessionCreate = z.infer<typeof focusSessionCreate>;
export type FocusSessionTransition = z.infer<typeof focusSessionTransition>;
