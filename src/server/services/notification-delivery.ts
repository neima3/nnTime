import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import dbDefault from "../db";
import * as schema from "../db/schema";
import type { Db } from "../dal";
import { isQuietAt } from "@/lib/quiet-hours";
import { instantToWallFields } from "../temporal/zone";
import { expandActivitiesForDay } from "./day";
import {
  activityFireTimes,
  buildPushPayload,
  hideActivityTitlesOnLockScreen,
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
  claimToken: string;
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
    claimToken: String(row.claimToken ?? row.claim_token),
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
      claim_token = gen_random_uuid(),
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
      jobs.payload,
      jobs.claim_token AS "claimToken"
  `);
  return normalizeClaimedJobs(result);
}

async function transitionJob(
  db: Db,
  job: ClaimedJob,
  values: Partial<typeof schema.notificationJobs.$inferInsert>,
): Promise<boolean> {
  const transitioned = await db
    .update(schema.notificationJobs)
    .set(values)
    .where(
      and(
        eq(schema.notificationJobs.id, job.id),
        eq(schema.notificationJobs.state, "processing"),
        eq(schema.notificationJobs.claimToken, job.claimToken),
      ),
    )
    .returning({ id: schema.notificationJobs.id });
  return transitioned.length === 1;
}

async function renewClaim(
  db: Db,
  job: ClaimedJob,
  now: Date,
): Promise<boolean> {
  return transitionJob(db, job, {
    claimedAt: now,
    updatedAt: now,
  });
}

export async function deliverDueNotificationJobs(
  opts: {
    db?: Db;
    now?: Date;
    limit?: number;
    send?: typeof sendToUser;
    clock?: () => Date;
    beforeSend?: () => Promise<void>;
  } = {},
): Promise<{
  considered: number;
  delivered: number;
  suppressed: number;
  retried: number;
  expired: number;
    pruned: number;
    retryableFailures: number;
  }> {
  const db = opts.db ?? dbDefault;
  const now = opts.now ?? new Date();
  const clock =
    opts.clock ?? (opts.now ? () => opts.now! : () => new Date());
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
    retryableFailures: 0,
  };

  for (const job of claimed) {
    const decisionAt = clock();
    if (job.expiresAt <= decisionAt) {
      if (await transitionJob(db, job, {
        state: "expired",
        lastError: "delivery-window-expired",
        claimedAt: null,
        claimToken: null,
        updatedAt: decisionAt,
      })) {
        summary.expired++;
      }
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
      if (await transitionJob(db, job, {
        state: "suppressed",
        lastError: "preference-disabled",
        claimedAt: null,
        claimToken: null,
        updatedAt: decisionAt,
      })) {
        summary.suppressed++;
      }
      continue;
    }

    const quietHour = instantToWallFields(decisionAt, timezone).hour;
    if (isQuietAt(prefs, quietHour)) {
      if (await transitionJob(db, job, {
        state: "suppressed",
        lastError: "quiet-hours",
        claimedAt: null,
        claimToken: null,
        updatedAt: decisionAt,
      })) {
        summary.suppressed++;
      }
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
        if (await transitionJob(db, job, {
          state: "suppressed",
          lastError: "source-missing",
          claimedAt: null,
          claimToken: null,
          updatedAt: decisionAt,
        })) {
          summary.suppressed++;
        }
        continue;
      }
      const [occurrence] = await db
        .select()
        .from(schema.activityOccurrences)
        .where(
          and(
            eq(schema.activityOccurrences.userId, job.userId),
            eq(schema.activityOccurrences.seriesId, series.id),
            eq(
              schema.activityOccurrences.occurrenceKey,
              job.occurrenceKey!,
            ),
            isNull(schema.activityOccurrences.deletedAt),
          ),
        )
        .limit(1);
      const occurrenceKey = job.occurrenceKey!;
      const [activity] = expandActivitiesForDay(
        [series],
        occurrence ? [occurrence] : [],
        {
          start: occurrenceKey,
          end: new Date(occurrenceKey.getTime() + 1),
        },
      );
      const stillDesired =
        activity?.status === "pending" &&
        activityFireTimes(
          activity.dtstartLocal,
          activity.durationMin,
          prefs,
        ).some(
          (candidate) =>
            candidate.type === job.type &&
            candidate.fireAt.getTime() === job.fireAt.getTime(),
        );
      if (!stillDesired) {
        if (await transitionJob(db, job, {
          state: "suppressed",
          lastError: "source-missing",
          claimedAt: null,
          claimToken: null,
          updatedAt: decisionAt,
        })) {
          summary.suppressed++;
        }
        continue;
      }
      payload = buildPushPayload(job.type, {
        title: activity.title,
        emoji: series.emoji ?? undefined,
        entityId: series.id,
        hideActivityTitle:
          hideActivityTitlesOnLockScreen(prefs),
      });
    } else {
      payload = buildPushPayload(job.type, {});
    }

    await opts.beforeSend?.();
    const sendStartedAt = clock();
    if (!(await renewClaim(db, job, sendStartedAt))) continue;
    if (job.expiresAt <= sendStartedAt) {
      if (await transitionJob(db, job, {
        state: "expired",
        lastError: "delivery-window-expired",
        claimedAt: null,
        claimToken: null,
        updatedAt: sendStartedAt,
      })) {
        summary.expired++;
      }
      continue;
    }
    const sendHour = instantToWallFields(sendStartedAt, timezone).hour;
    if (isQuietAt(prefs, sendHour)) {
      if (await transitionJob(db, job, {
        state: "suppressed",
        lastError: "quiet-hours",
        claimedAt: null,
        claimToken: null,
        updatedAt: sendStartedAt,
      })) {
        summary.suppressed++;
      }
      continue;
    }

    const attempt = job.attempts + 1;
    const outcome = await send(job.userId, payload, { db });
    const completedAt = clock();
    summary.pruned += outcome.pruned;
    summary.retryableFailures += outcome.retryableFailures;

    if (!outcome.configured) {
      if (await transitionJob(db, job, {
        state: "suppressed",
        lastError: "push-unconfigured",
        claimedAt: null,
        claimToken: null,
        updatedAt: completedAt,
      })) {
        summary.suppressed++;
      }
      continue;
    }

    if (outcome.sent > 0) {
      if (await transitionJob(db, job, {
        state: "sent",
        attempts: attempt,
        lastError: null,
        claimedAt: null,
        claimToken: null,
        deliveredAt: completedAt,
        updatedAt: completedAt,
      })) {
        summary.delivered++;
      }
      continue;
    }

    if (outcome.retryableFailures > 0) {
      if (attempt >= MAX_ATTEMPTS) {
        if (await transitionJob(db, job, {
          state: "expired",
          attempts: attempt,
          lastError: "retry-exhausted",
          claimedAt: null,
          claimToken: null,
          updatedAt: completedAt,
        })) {
          summary.expired++;
        }
      } else {
        if (await transitionJob(db, job, {
          state: "retry",
          attempts: attempt,
          nextAttemptAt: new Date(
            completedAt.getTime() + retryDelayMs(attempt),
          ),
          lastError: "transient-push-failure",
          claimedAt: null,
          claimToken: null,
          updatedAt: completedAt,
        })) {
          summary.retried++;
        }
      }
      continue;
    }

    if (await transitionJob(db, job, {
      state: "suppressed",
      attempts: attempt,
      lastError: "no-subscriptions",
      claimedAt: null,
      claimToken: null,
      updatedAt: completedAt,
    })) {
      summary.suppressed++;
    }
  }

  return summary;
}
