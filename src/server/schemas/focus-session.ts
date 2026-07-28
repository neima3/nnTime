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

const databaseInstant = z.preprocess(
  (value) => (value instanceof Date ? value.toISOString() : value),
  instant,
);

/** Focus session response body. */
export const focusSessionResponse = z.object({
  ...managedRowFields,
  createdAt: databaseInstant,
  updatedAt: databaseInstant,
  // Better Auth owns user IDs as opaque text; UUID formatting is not guaranteed.
  userId: z.string().min(1),
  /** Nullable for ad-hoc sessions not tied to an occurrence. */
  activityOccurrenceId: uuid.nullable(),
  state: focusStateEnum,
  startedAt: databaseInstant,
  targetDurationMin: z.number().int(),
  accumulatedPauseSec: z.number().int(),
  /** When the current running/paused interval began; null when idle. */
  currentIntervalStartedAt: databaseInstant.nullable(),
  /** Free-text reason captured on completion (e.g. "finished", "interrupted"). */
  completionReason: z.string().nullable(),
});

/** POST /api/v1/focus-sessions body. Server time owns `startedAt`. */
export const focusSessionCreateRequest = z.object({
  activityOccurrenceId: uuid.optional(),
  targetDurationMin: z.number().int().positive().max(24 * 60),
  title: z.string().optional(),
  emoji: z.string().optional(),
});

/** PATCH /api/v1/focus-sessions/{id} body. */
export const focusSessionPatchRequest = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("transition"),
    state: focusStateEnum,
  }),
  z.object({
    action: z.literal("extend"),
    addMinutes: z.union([z.literal(1), z.literal(5), z.literal(10)]),
  }),
]);

/** Active focus read model used by GET/POST/PATCH focus endpoints. */
export const focusSnapshotResponse = z.object({
  session: focusSessionResponse.nullable(),
  remainingSec: z.number().int().optional(),
});

/** Backward-compatible schema aliases for existing imports. */
export const focusSessionCreate = focusSessionCreateRequest;
export const focusSessionTransition = z.object({ state: focusStateEnum });

export type FocusSessionResponse = z.infer<typeof focusSessionResponse>;
export type FocusSessionCreate = z.infer<typeof focusSessionCreateRequest>;
export type FocusSessionPatch = z.infer<typeof focusSessionPatchRequest>;
export type FocusSnapshotResponse = z.infer<typeof focusSnapshotResponse>;
