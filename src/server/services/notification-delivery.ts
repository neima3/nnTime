import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import dbDefault from "../db";
import * as schema from "../db/schema";
import type { Db } from "../dal";
import { isQuietAt } from "@/lib/quiet-hours";
import { instantToWallFields } from "../temporal/zone";
import {
  buildPushPayload,
  notificationTypeEnabled,
  retryDelayMs,
} from "./notification-policy";
import { sendToUser } from "./push";

const CLAIM_LEASE_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

interface ClaimedJob {
  id: string;
  userId: string;
  entityType: "activity" | "review";
  entityId: string | null;
  occurrenceKey: Date | null;
  type: schema.DbNotificationJob["type"];
  fireAt: Date;
  expiresAt: Date;
  state: schema.DbNotificationJob["state"];
  attempts: number;
  payload: unknown;
}

function rowsFromResult(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (
    result &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray((result as { rows: unknown[] }).rows)
  ) {
    return (result as { rows: Record<string, unknown>[] }).rows;
  }
  return [];
}

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function normalizeClaimedJobs(result: unknown): ClaimedJob[] {
  return rowsFromResult(result).map((row) => ({
    id: String(row.id),
    userId: String(row.userId ?? row.user_id),
    entityType: String(
      row.entityType ?? row.entity_type,
    ) as ClaimedJob["entityType"],
    entityId:
      row.entityId ?? row.entity_id
        ? String(row.entityId ?? row.entity_id)
        : null,
    occurrenceKey:
      row.occurrenceKey ?? row.occurrence_key
        ? toDate(row.occurrenceKey ?? row.occurrence_key)
        : null,
    type: String(row.type) as ClaimedJob["type"],
    fireAt: toDate(row.fireAt ?? row.fire_at),
    expiresAt: toDate(row.expiresAt ?? row.expires_at),
    state: String(row.state) as ClaimedJob["state"],
    attempts: Number(row.attempts ?? 0),
    payload: row.payload,
  }));
}

async function claimDueJobs(
  db: Db,
  now: Date,
  limit: number,
): Promise<ClaimedJob[]> {
  const staleBefore = new Date(now.getTime() - CLAIM_LEASE_MS);
  const nowIso = now.toISOString();
  const staleBeforeIso = staleBefore.toISOString();
  const result = await db.execute(sql`
    WITH due AS (
      SELECT id
      FROM notification_jobs
      WHERE (
        state IN ('pending', 'retry')
        AND next_attempt_at <= ${nowIso}::timestamptz
        AND fire_at <= ${nowIso}::timestamptz
      ) OR (
        state = 'processing'
        AND claimed_at <= ${staleBeforeIso}::timestamptz
      )
      ORDER BY fire_at, created_at
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE notification_jobs AS jobs
    SET
      state = 'processing',
      claimed_at = ${nowIso}::timestamptz,
      updated_at = ${nowIso}::timestamptz
    FROM due
    WHERE jobs.id = due.id
    RETURNING
      jobs.id,
      jobs.user_id AS "userId",
      jobs.entity_type AS "entityType",
      jobs.entity_id AS "entityId",
      jobs.occurrence_key AS "occurrenceKey",
      jobs.type,
      jobs.fire_at AS "fireAt",
      jobs.expires_at AS "expiresAt",
      jobs.state,
      jobs.attempts,
      jobs.payload
  `);
  return normalizeClaimedJobs(result);
}

async function transitionJob(
  db: Db,
  id: string,
  values: Partial<typeof schema.notificationJobs.$inferInsert>,
) {
  await db
    .update(schema.notificationJobs)
    .set(values)
    .where(eq(schema.notificationJobs.id, id));
}

export async function deliverDueNotificationJobs(
  opts: {
    db?: Db;
    now?: Date;
    limit?: number;
    send?: typeof sendToUser;
  } = {},
): Promise<{
  considered: number;
  delivered: number;
  suppressed: number;
  retried: number;
  expired: number;
  pruned: number;
}> {
  const db = opts.db ?? dbDefault;
  const now = opts.now ?? new Date();
  const limit = Math.min(Math.max(Math.floor(opts.limit ?? 200), 1), 500);
  const send = opts.send ?? sendToUser;
  const claimed = await claimDueJobs(db, now, limit);
  const summary = {
    considered: claimed.length,
    delivered: 0,
    suppressed: 0,
    retried: 0,
    expired: 0,
    pruned: 0,
  };

  for (const job of claimed) {
    if (job.expiresAt <= now) {
      await transitionJob(db, job.id, {
        state: "expired",
        lastError: "delivery-window-expired",
        claimedAt: null,
        updatedAt: now,
      });
      summary.expired++;
      continue;
    }

    const [settings] = await db
      .select()
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, job.userId))
      .limit(1);
    const timezone = settings?.timezone ?? "UTC";
    const prefs = settings?.notificationPrefs ?? {};

    if (!notificationTypeEnabled(prefs, job.type)) {
      await transitionJob(db, job.id, {
        state: "suppressed",
        lastError: "preference-disabled",
        claimedAt: null,
        updatedAt: now,
      });
      summary.suppressed++;
      continue;
    }

    const quietHour = instantToWallFields(job.fireAt, timezone).hour;
    if (isQuietAt(prefs, quietHour)) {
      await transitionJob(db, job.id, {
        state: "suppressed",
        lastError: "quiet-hours",
        claimedAt: null,
        updatedAt: now,
      });
      summary.suppressed++;
      continue;
    }

    let payload;
    if (job.entityType === "activity") {
      const [series] = await db
        .select()
        .from(schema.activitySeries)
        .where(
          and(
            eq(schema.activitySeries.userId, job.userId),
            eq(schema.activitySeries.id, job.entityId!),
            isNull(schema.activitySeries.deletedAt),
          ),
        )
        .limit(1);
      if (!series) {
        await transitionJob(db, job.id, {
          state: "suppressed",
          lastError: "source-missing",
          claimedAt: null,
          updatedAt: now,
        });
        summary.suppressed++;
        continue;
      }
      payload = buildPushPayload(job.type, {
        title: series.title,
        emoji: series.emoji ?? undefined,
        entityId: series.id,
      });
    } else {
      payload = buildPushPayload(job.type, {});
    }

    const attempt = job.attempts + 1;
    const outcome = await send(job.userId, payload, { db });
    summary.pruned += outcome.pruned;

    if (!outcome.configured) {
      await transitionJob(db, job.id, {
        state: "suppressed",
        lastError: "push-unconfigured",
        claimedAt: null,
        updatedAt: now,
      });
      summary.suppressed++;
      continue;
    }

    if (outcome.sent > 0) {
      await transitionJob(db, job.id, {
        state: "sent",
        attempts: attempt,
        lastError: null,
        claimedAt: null,
        deliveredAt: now,
        updatedAt: now,
      });
      summary.delivered++;
      continue;
    }

    if (outcome.retryableFailures > 0) {
      if (attempt >= MAX_ATTEMPTS) {
        await transitionJob(db, job.id, {
          state: "expired",
          attempts: attempt,
          lastError: "retry-exhausted",
          claimedAt: null,
          updatedAt: now,
        });
        summary.expired++;
      } else {
        await transitionJob(db, job.id, {
          state: "retry",
          attempts: attempt,
          nextAttemptAt: new Date(now.getTime() + retryDelayMs(attempt)),
          lastError: "transient-push-failure",
          claimedAt: null,
          updatedAt: now,
        });
        summary.retried++;
      }
      continue;
    }

    await transitionJob(db, job.id, {
      state: "suppressed",
      attempts: attempt,
      lastError: "no-subscriptions",
      claimedAt: null,
      updatedAt: now,
    });
    summary.suppressed++;
  }

  return summary;
}
