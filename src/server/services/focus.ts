/**
 * Focus-session state machine — ADR-004 (server-authoritative).
 *
 * Binding contract (ADR-004):
 *  - States: running | paused | completed | skipped | cancelled.
 *  - Partial unique index = one active session per user (enforced at the DB).
 *  - Transitions are idempotent, validated, and use server time.
 *  - Clients derive remaining time from the row; they never persist countdowns.
 *  - Defined: reload/navigation, two-device contention (second adopts, first
 *    yields), sleep/wake reconstruction, clock skew (server wins), overtime
 *    (stays running), activity edited (keeps captured target), activity deleted
 *    (auto-cancels).
 *  - Quick-extend (+1/+5/+10 min) and live checklist check-off.
 */
import "server-only";
import dbDefault from "../db";
import type { Db } from "../dal";
import * as schema from "../db/schema";
import { and, eq, inArray } from "drizzle-orm";
import {
  appendChangeLog,
  BadRequestError,
  ConflictError,
  getActivitySeries,
  getOccurrence,
  getOccurrenceByKey,
  materializeOccurrenceIfAbsent,
  NotFoundError,
} from "../dal";
import { seriesGeneratesOccurrenceKey } from "./recurrence";

export type FocusState = "running" | "paused" | "completed" | "skipped" | "cancelled";

/** Legal state transitions. */
const TRANSITIONS: Record<FocusState, FocusState[]> = {
  running: ["paused", "completed", "skipped", "cancelled"],
  paused: ["running", "completed", "skipped", "cancelled"],
  completed: [],
  skipped: [],
  cancelled: [],
};

function parseOccurrenceKey(value: Date | string): Date {
  const key = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(key.getTime())) {
    throw new BadRequestError("occurrenceKey must be an RFC 3339 instant");
  }
  return key;
}

/**
 * Resolve the occurrence row to attach. Selector validation and materialization
 * happen before any yield so a failed start cannot cancel the active session.
 */
export async function resolveFocusOccurrenceId(
  userId: string,
  input: {
    activityOccurrenceId?: string;
    activitySeriesId?: string;
    occurrenceKey?: Date | string;
  },
  opts: { db?: Db } = {},
): Promise<string | null> {
  const db = opts.db ?? dbDefault;
  const hasRow = input.activityOccurrenceId != null;
  const hasSeries = input.activitySeriesId != null;
  const hasKey = input.occurrenceKey != null;
  if (hasSeries !== hasKey) {
    throw new BadRequestError(
      "activitySeriesId and occurrenceKey must be provided together",
    );
  }
  if (hasRow && (hasSeries || hasKey)) {
    throw new BadRequestError(
      "activityOccurrenceId cannot be combined with activitySeriesId/occurrenceKey",
    );
  }
  if (hasRow) {
    await getOccurrence(userId, input.activityOccurrenceId!, { db });
    return input.activityOccurrenceId!;
  }
  if (!hasSeries || !hasKey) return null;

  const occurrenceKey = parseOccurrenceKey(input.occurrenceKey!);
  const series = await getActivitySeries(userId, input.activitySeriesId!, { db });
  const existing = await getOccurrenceByKey(
    userId,
    series.id,
    occurrenceKey,
    { db },
  );
  if (existing) {
    if (existing.status === "cancelled" || existing.status === "skipped") {
      throw new NotFoundError("activity_occurrence");
    }
    return existing.id;
  }
  if (!seriesGeneratesOccurrenceKey(series, occurrenceKey)) {
    throw new NotFoundError("activity_occurrence");
  }
  // Re-read the parent so a concurrent tombstone cannot materialize.
  await getActivitySeries(userId, series.id, { db });
  const materialized = await materializeOccurrenceIfAbsent(
    userId,
    series.id,
    occurrenceKey,
    { db },
  );
  if (materialized.status === "cancelled" || materialized.status === "skipped") {
    throw new NotFoundError("activity_occurrence");
  }
  return materialized.id;
}

/**
 * Additive identity on the wire so clients can reconstruct (series, key)
 * after reload without guessing. `activityOccurrenceId` stays authoritative.
 */
export async function presentFocusSession(
  userId: string,
  session: typeof schema.focusSessions.$inferSelect,
  opts: { db?: Db } = {},
) {
  if (!session.activityOccurrenceId) {
    return { ...session, activitySeriesId: null, occurrenceKey: null };
  }
  try {
    const occ = await getOccurrence(userId, session.activityOccurrenceId, opts);
    return {
      ...session,
      activitySeriesId: occ.seriesId,
      occurrenceKey: occ.occurrenceKey,
    };
  } catch {
    return { ...session, activitySeriesId: null, occurrenceKey: null };
  }
}

/**
 * Start a focus session. If the user already has an active session, that one is
 * yielded (auto-cancelled) — two-device contention: second device adopts.
 * Returns the new session.
 */
export async function startFocusSession(
  userId: string,
  input: {
    activityOccurrenceId?: string;
    activitySeriesId?: string;
    occurrenceKey?: Date | string;
    targetDurationMin: number;
  },
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  const now = new Date();

  // One transaction so the yield + insert are atomic, and so appendChangeLog's
  // per-user advisory lock actually holds until commit — outside a transaction
  // it would be released immediately and the sync cursor could skip this row.
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;

    // ADR-005 SEC-01: prove occurrence ownership / eligibility BEFORE yielding
    // the caller's active session. A foreign / missing / ineligible identity
    // is 404 and must leave the existing session running.
    const activityOccurrenceId = await resolveFocusOccurrenceId(userId, input, {
      db: tdb,
    });

    // Yield any existing active session (two-device contention: the new one wins).
    await tdb
      .update(schema.focusSessions)
      .set({
        state: "cancelled",
        completionReason: "superseded",
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.focusSessions.userId, userId),
          inArray(schema.focusSessions.state, ["running", "paused"]),
        ),
      );

    const id = crypto.randomUUID();
    const [session] = await tdb
      .insert(schema.focusSessions)
      .values({
        id,
        userId,
        activityOccurrenceId,
        state: "running",
        startedAt: now,
        targetDurationMin: input.targetDurationMin,
        currentIntervalStartedAt: now,
      })
      .returning();
    await appendChangeLog(tdb, userId, "focus_sessions", id, "upsert", session!.revision);
    return session!;
  });
}

/**
 * Transition a focus session to a new state. Validates the transition is legal.
 * Handles pause/resume time accumulation. Returns the updated session.
 */
export async function transitionFocusSession(
  userId: string,
  sessionId: string,
  newState: FocusState,
  ifMatchRevision: number,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  const now = new Date();

  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const [session] = await tdb
      .select()
      .from(schema.focusSessions)
      .where(
        and(
          eq(schema.focusSessions.id, sessionId),
          eq(schema.focusSessions.userId, userId),
        ),
      )
      .limit(1);
    if (!session) throw new Error("focus session not found");
    if (session.revision !== ifMatchRevision) {
      throw new ConflictError("revision mismatch", session);
    }

    // Validate transition.
    if (!TRANSITIONS[session.state as FocusState]?.includes(newState)) {
      throw new Error(`illegal transition: ${session.state} → ${newState}`);
    }

    const updates: Partial<typeof schema.focusSessions.$inferInsert> = {
      state: newState,
      updatedAt: now,
    };

    if (newState === "paused") {
      // Mark pause start; do not touch accumulatedPauseSec (running time is not pause).
      updates.currentIntervalStartedAt = now;
    } else if (newState === "running" && session.state === "paused") {
      // Fold the completed pause interval into accumulatedPauseSec, then resume.
      if (session.currentIntervalStartedAt) {
        const pauseElapsedSec = Math.floor(
          (now.getTime() - session.currentIntervalStartedAt.getTime()) / 1000,
        );
        updates.accumulatedPauseSec = session.accumulatedPauseSec + pauseElapsedSec;
      }
      updates.currentIntervalStartedAt = now;
    } else if (newState === "completed" || newState === "skipped" || newState === "cancelled") {
      updates.currentIntervalStartedAt = null;
      if (newState === "completed") {
        updates.completionReason = "manual";
      }
    }

    const [updated] = await tdb
      .update(schema.focusSessions)
      .set({ ...updates, revision: ifMatchRevision + 1 })
      .where(
        and(
          eq(schema.focusSessions.id, sessionId),
          eq(schema.focusSessions.userId, userId),
          eq(schema.focusSessions.revision, ifMatchRevision),
        ),
      )
      .returning();
    if (!updated) {
      const [current] = await tdb
        .select()
        .from(schema.focusSessions)
        .where(
          and(
            eq(schema.focusSessions.id, sessionId),
            eq(schema.focusSessions.userId, userId),
          ),
        )
        .limit(1);
      if (!current) throw new Error("focus session not found");
      throw new ConflictError("revision mismatch", current);
    }
    await appendChangeLog(tdb, userId, "focus_sessions", sessionId, "upsert", updated.revision);
    return updated;
  });
}

/**
 * Quick-extend: add minutes to the target duration of a running/paused session.
 * ADR-004: the focus screen's extend button, made granular (+1/+5/+10).
 */
export async function extendFocusSession(
  userId: string,
  sessionId: string,
  addMinutes: number,
  ifMatchRevision: number,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  const [session] = await db
    .select()
    .from(schema.focusSessions)
    .where(
      and(
        eq(schema.focusSessions.id, sessionId),
        eq(schema.focusSessions.userId, userId),
      ),
    )
    .limit(1);
  if (!session) throw new Error("focus session not found");
  if (session.revision !== ifMatchRevision) {
    throw new ConflictError("revision mismatch", session);
  }
  if (session.state !== "running" && session.state !== "paused") {
    throw new Error("can only extend an active session");
  }
  const [updated] = await db
    .update(schema.focusSessions)
    .set({
      targetDurationMin: session.targetDurationMin + addMinutes,
      revision: ifMatchRevision + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.focusSessions.id, sessionId),
        eq(schema.focusSessions.userId, userId),
        eq(schema.focusSessions.revision, ifMatchRevision),
      ),
    )
    .returning();
  if (!updated) {
    const [current] = await db
      .select()
      .from(schema.focusSessions)
      .where(
        and(
          eq(schema.focusSessions.id, sessionId),
          eq(schema.focusSessions.userId, userId),
        ),
      )
      .limit(1);
    if (!current) throw new Error("focus session not found");
    throw new ConflictError("revision mismatch", current);
  }
  return updated;
}

/**
 * Derive the remaining time for a session. Clients call this to display the
 * countdown without persisting it (ADR-004: clients derive, never persist).
 *
 * While paused, freezes effective "now" at currentIntervalStartedAt (pause start)
 * so the countdown does not decay. `nowMs` is injectable for pure unit tests.
 */
export function getRemainingSec(
  session: {
    state: FocusState;
    startedAt: Date;
    targetDurationMin: number;
    accumulatedPauseSec: number;
    currentIntervalStartedAt: Date | null;
  },
  nowMs: number = Date.now(),
): number {
  let effectiveNow = nowMs;
  if (session.state === "paused" && session.currentIntervalStartedAt) {
    effectiveNow = session.currentIntervalStartedAt.getTime();
  }
  const startMs = session.startedAt.getTime();
  const pauseMs = session.accumulatedPauseSec * 1000;
  const elapsedMs = effectiveNow - startMs - pauseMs;
  const targetMs = session.targetDurationMin * 60 * 1000;
  return Math.floor((targetMs - elapsedMs) / 1000);
}

/**
 * Get the user's active focus session (running or paused), if any.
 * Used by the UI to rehydrate on reload/navigation (ADR-004).
 */
export async function getActiveSession(userId: string, opts: { db?: Db } = {}) {
  const db = opts.db ?? dbDefault;
  const [session] = await db
    .select()
    .from(schema.focusSessions)
    .where(
      and(
        eq(schema.focusSessions.userId, userId),
        inArray(schema.focusSessions.state, ["running", "paused"]),
      ),
    )
    .limit(1);
  return session ?? null;
}
