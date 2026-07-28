import "server-only";
import dbDefault from "../db";
import type { Db } from "../dal";
import * as schema from "../db/schema";
import {
  and,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { expandActivitiesForDay } from "./day";
import {
  activityDedupKey,
  activityFireTimes,
  buildPushPayload,
  hideActivityTitlesOnLockScreen,
  notificationSoundEnabled,
  notificationTypeEnabled,
  type NotificationPushPayload,
  type NotificationType,
} from "./notification-policy";
import { instantToWallFields, wallClockToInstant } from "../temporal/zone";

const NOTIFICATION_LOCK_KEY = 8_947_232;
const HOUR_MS = 60 * 60_000;
const REVIEW_EXPIRY_MS = 4 * HOUR_MS;

export interface DesiredNotificationJob {
  userId: string;
  entityType: "activity" | "review";
  entityId: string | null;
  occurrenceKey: Date | null;
  type: NotificationType;
  fireAt: Date;
  expiresAt: Date;
  dedupKey: string;
  payload: NotificationPushPayload;
}

function parseAdvisoryLock(result: unknown): boolean {
  const rows: unknown[] = Array.isArray(result)
    ? result
    : result &&
        typeof result === "object" &&
        "rows" in result &&
        Array.isArray((result as { rows: unknown[] }).rows)
      ? (result as { rows: unknown[] }).rows
      : [];
  const row = rows[0];
  if (!row || typeof row !== "object") return false;
  const value = (row as Record<string, unknown>).got_lock;
  return (
    value === true ||
    value === "t" ||
    value === "true" ||
    value === 1 ||
    value === "1"
  );
}

function localDateParts(instant: Date, timezone: string) {
  const wall = instantToWallFields(instant, timezone);
  return {
    year: wall.year,
    month: wall.month,
    day: wall.day,
    dayOfWeek: new Date(
      Date.UTC(wall.year, wall.month, wall.day),
    ).getUTCDay(),
  };
}

function addLocalDays(
  parts: { year: number; month: number; day: number },
  days: number,
) {
  const shifted = new Date(
    Date.UTC(parts.year, parts.month, parts.day + days),
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

function localDateKey(parts: { year: number; month: number; day: number }) {
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month + 1).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

function reviewJob(input: {
  userId: string;
  type: "review-today" | "weekly-review";
  fireAt: Date;
  localDate: string;
  soundEnabled: boolean;
}): DesiredNotificationJob {
  return {
    userId: input.userId,
    entityType: "review",
    entityId: null,
    occurrenceKey: null,
    type: input.type,
    fireAt: input.fireAt,
    expiresAt: new Date(input.fireAt.getTime() + REVIEW_EXPIRY_MS),
    dedupKey: [
      input.userId,
      "review",
      input.type,
      input.localDate,
      input.fireAt.toISOString(),
    ].join(":"),
    payload: buildPushPayload(input.type, {
      soundEnabled: input.soundEnabled,
    }),
  };
}

function desiredReviewJobs(
  settings: typeof schema.userSettings.$inferSelect,
  now: Date,
  horizon: Date,
): DesiredNotificationJob[] {
  const jobs: DesiredNotificationJob[] = [];
  const today = localDateParts(now, settings.timezone);

  if (
    notificationTypeEnabled(
      settings.notificationPrefs,
      "review-today",
    )
  ) {
    let date = today;
    let fireAt = wallClockToInstant(
      date.year,
      date.month,
      date.day,
      20,
      0,
      0,
      settings.timezone,
    );
    if (fireAt < now) {
      date = { ...addLocalDays(today, 1), dayOfWeek: (today.dayOfWeek + 1) % 7 };
      fireAt = wallClockToInstant(
        date.year,
        date.month,
        date.day,
        20,
        0,
        0,
        settings.timezone,
      );
    }
    if (fireAt < horizon) {
      jobs.push(
        reviewJob({
          userId: settings.userId,
          type: "review-today",
          fireAt,
          localDate: localDateKey(date),
          soundEnabled: notificationSoundEnabled(
            settings.notificationPrefs,
          ),
        }),
      );
    }
  }

  if (
    notificationTypeEnabled(
      settings.notificationPrefs,
      "weekly-review",
    )
  ) {
    const weekEnd = (settings.weekStart + 6) % 7;
    let daysUntil = (weekEnd - today.dayOfWeek + 7) % 7;
    let date = addLocalDays(today, daysUntil);
    let fireAt = wallClockToInstant(
      date.year,
      date.month,
      date.day,
      18,
      0,
      0,
      settings.timezone,
    );
    if (fireAt < now) {
      daysUntil += 7;
      date = addLocalDays(today, daysUntil);
      fireAt = wallClockToInstant(
        date.year,
        date.month,
        date.day,
        18,
        0,
        0,
        settings.timezone,
      );
    }
    if (fireAt < horizon) {
      jobs.push(
        reviewJob({
          userId: settings.userId,
          type: "weekly-review",
          fireAt,
          localDate: localDateKey(date),
          soundEnabled: notificationSoundEnabled(
            settings.notificationPrefs,
          ),
        }),
      );
    }
  }

  return jobs;
}

export async function computeNotificationJobs(
  opts: { db?: Db; now?: Date; horizonHours?: number } = {},
): Promise<{
  desired: number;
  created: number;
  cancelled: number;
  lockAcquired: boolean;
}> {
  const db = opts.db ?? dbDefault;
  const now = opts.now ?? new Date();
  const horizon = new Date(
    now.getTime() + (opts.horizonHours ?? 24) * HOUR_MS,
  );

  return db.transaction(async (transaction) => {
    const tx = transaction as unknown as Db;
    const lockResult = await tx.execute(
      sql`SELECT pg_try_advisory_xact_lock(${NOTIFICATION_LOCK_KEY}) AS got_lock`,
    );
    if (!parseAdvisoryLock(lockResult)) {
      return {
        desired: 0,
        created: 0,
        cancelled: 0,
        lockAcquired: false,
      };
    }

    const [settingsRows, occurrenceRows] = await Promise.all([
      tx.select().from(schema.userSettings),
      tx
        .select()
        .from(schema.activityOccurrences)
        .where(isNull(schema.activityOccurrences.deletedAt)),
    ]);
    const movedIntoHorizonSeriesIds = [
      ...new Set(
        occurrenceRows
          .filter(
            (occurrence) =>
              occurrence.startAt !== null &&
              occurrence.startAt < horizon,
          )
          .map((occurrence) => occurrence.seriesId),
      ),
    ];
    const seriesRows = await tx
      .select()
      .from(schema.activitySeries)
      .where(
        and(
          isNull(schema.activitySeries.deletedAt),
          movedIntoHorizonSeriesIds.length > 0
            ? or(
                lte(schema.activitySeries.dtstartLocal, horizon),
                inArray(
                  schema.activitySeries.id,
                  movedIntoHorizonSeriesIds,
                ),
              )
            : lte(schema.activitySeries.dtstartLocal, horizon),
        ),
      );
    const prefsByUser = new Map(
      settingsRows.map((settings) => [
        settings.userId,
        settings.notificationPrefs,
      ]),
    );

    const activities = expandActivitiesForDay(
      seriesRows,
      occurrenceRows,
      { start: now, end: horizon },
    );
    const expandedOccurrenceKeys = new Set(
      activities.map(
        (activity) =>
          `${activity.id}|${activity.occurrenceKey.getTime()}`,
      ),
    );
    const seriesById = new Map(
      seriesRows.map((series) => [series.id, series]),
    );
    for (const occurrence of occurrenceRows) {
      if (
        occurrence.status !== "pending" ||
        occurrence.startAt === null ||
        occurrence.startAt >= horizon
      ) {
        continue;
      }
      const occurrenceIdentity = `${occurrence.seriesId}|${occurrence.occurrenceKey.getTime()}`;
      if (expandedOccurrenceKeys.has(occurrenceIdentity)) continue;
      const series = seriesById.get(occurrence.seriesId);
      if (!series || series.userId !== occurrence.userId) continue;
      const durationMin = occurrence.durationMin ?? series.durationMin;
      if (
        occurrence.startAt.getTime() + durationMin * 60_000 <=
        now.getTime()
      ) {
        continue;
      }
      activities.push({
        ...series,
        dtstartLocal: occurrence.startAt,
        durationMin,
        title: occurrence.title ?? series.title,
        energy: occurrence.energy ?? series.energy,
        checklistTemplate:
          occurrence.checklistOverride ?? series.checklistTemplate,
        occurrenceKey: occurrence.occurrenceKey,
        status: occurrence.status,
      });
    }
    const desired: DesiredNotificationJob[] = [];

    for (const activity of activities) {
      if (activity.status !== "pending") continue;
      const prefs = prefsByUser.get(activity.userId);
      for (const candidate of activityFireTimes(
        activity.dtstartLocal,
        activity.durationMin,
        prefs,
      )) {
        if (
          candidate.fireAt < now ||
          candidate.fireAt >= horizon ||
          !notificationTypeEnabled(prefs, candidate.type)
        ) {
          continue;
        }
        desired.push({
          userId: activity.userId,
          entityType: "activity",
          entityId: activity.id,
          occurrenceKey: activity.occurrenceKey,
          type: candidate.type,
          fireAt: candidate.fireAt,
          expiresAt: candidate.expiresAt,
          dedupKey: activityDedupKey({
            userId: activity.userId,
            seriesId: activity.id,
            occurrenceKey: activity.occurrenceKey,
            type: candidate.type,
            fireAt: candidate.fireAt,
          }),
          payload: buildPushPayload(candidate.type, {
            title: activity.title,
            emoji: activity.emoji ?? undefined,
            entityId: activity.id,
            hideActivityTitle:
              hideActivityTitlesOnLockScreen(prefs),
            soundEnabled: notificationSoundEnabled(prefs),
          }),
        });
      }
    }

    for (const settings of settingsRows) {
      desired.push(...desiredReviewJobs(settings, now, horizon));
    }

    const desiredKeys = desired.map((job) => job.dedupKey);
    if (desiredKeys.length > 0) {
      await tx
        .update(schema.notificationJobs)
        .set({
          state: "pending",
          nextAttemptAt: sql`${schema.notificationJobs.fireAt}`,
          lastError: null,
          claimedAt: null,
          claimToken: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.notificationJobs.state, "cancelled"),
            inArray(schema.notificationJobs.dedupKey, desiredKeys),
          ),
        );
    }

    let created = 0;
    if (desired.length > 0) {
      const inserted = await tx
        .insert(schema.notificationJobs)
        .values(
          desired.map((job) => ({
            id: crypto.randomUUID(),
            ...job,
            nextAttemptAt: job.fireAt,
          })),
        )
        .onConflictDoNothing({ target: schema.notificationJobs.dedupKey })
        .returning({ id: schema.notificationJobs.id });
      created = inserted.length;
    }

    const cancellable = and(
      inArray(schema.notificationJobs.state, ["pending", "retry"]),
      gte(schema.notificationJobs.fireAt, now),
      lt(schema.notificationJobs.fireAt, horizon),
    );
    const cancelledRows = await tx
      .update(schema.notificationJobs)
      .set({
        state: "cancelled",
        lastError: "no-longer-desired",
        claimedAt: null,
        claimToken: null,
        updatedAt: now,
      })
      .where(
        desiredKeys.length > 0
          ? and(
              cancellable,
              notInArray(schema.notificationJobs.dedupKey, desiredKeys),
            )
          : cancellable,
      )
      .returning({ id: schema.notificationJobs.id });

    return {
      desired: desired.length,
      created,
      cancelled: cancelledRows.length,
      lockAcquired: true,
    };
  });
}

export async function registerPushSubscription(
  userId: string,
  input: { endpoint: string; keys: Record<string, string> },
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  const [subscription] = await db
    .insert(schema.pushSubscriptions)
    .values({
      id: crypto.randomUUID(),
      userId,
      endpoint: input.endpoint,
      keys: input.keys,
    })
    .onConflictDoUpdate({
      target: [
        schema.pushSubscriptions.userId,
        schema.pushSubscriptions.endpoint,
      ],
      set: { keys: input.keys, updatedAt: new Date(), deletedAt: null },
    })
    .returning();
  return subscription;
}

export async function unregisterPushSubscription(
  userId: string,
  endpoint: string,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  await db
    .update(schema.pushSubscriptions)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(schema.pushSubscriptions.userId, userId),
        eq(schema.pushSubscriptions.endpoint, endpoint),
      ),
    );
}
