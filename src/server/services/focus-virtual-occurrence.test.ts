/**
 * P1.2 — virtual occurrence selector → atomic materialize on focus start.
 *
 * Day activities expose series `id` + `occurrenceKey`. Virtual instances have
 * no activity_occurrences row and therefore no UUID. Focus start addresses
 * them by that pair and materializes inside the authenticated POST transaction.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  createEphemeralDb,
  insertUser,
  rethrowIfMigrationFailure,
  type EphemeralDb,
} from "../db/test-db";
import * as schema from "../db/schema";
import {
  BadRequestError,
  createActivitySeries,
  deleteActivitySeries,
  getOccurrence,
  NotFoundError,
  upsertOccurrence,
} from "../dal";
import { editSeriesOccurrence } from "./recurrence";
import { expandSeries } from "../temporal/recurrence";
import { instantToWallFields, wallClockToInstant } from "../temporal/zone";
import {
  getActiveSession,
  startFocusSession,
} from "./focus";

let env: EphemeralDb | null = null;
let dbAvailable = false;
let userId: string;

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
    userId = crypto.randomUUID();
    await insertUser(env.db, userId, "focus-virtual@test.com");
  } catch (e) {
    rethrowIfMigrationFailure(e);
    dbAvailable = false;
  }
}, 60000);

afterAll(async () => {
  if (env) await env.teardown();
}, 60000);

const itDb = (name: string, fn: () => Promise<void> | void) =>
  it(name, async ({ skip }) => {
    if (!dbAvailable || !env) {
      console.warn(`[SKIP] ${name}: Postgres unavailable`);
      skip(true, "Postgres unavailable");
      return;
    }
    await fn();
  });

function wallFields(instant: Date, tz: string) {
  return instantToWallFields(instant, tz);
}

function expandedKeys(
  series: {
    rrule: string | null;
    tz: string;
    dtstartLocal: Date;
    durationMin: number;
    rdate?: Date[] | null;
    exdate?: Date[] | null;
  },
  from: Date,
  to: Date,
) {
  const dtstart = wallFields(series.dtstartLocal, series.tz);
  return expandSeries({
    rrule: series.rrule,
    tz: series.tz,
    dtstart,
    from,
    to,
    durationMin: series.durationMin,
    rdates: series.rdate ?? undefined,
    exdates: (series.exdate ?? []).map((date) =>
      wallClockToInstant(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        dtstart.hour,
        dtstart.minute,
        dtstart.second,
        series.tz,
        "first",
      ),
    ),
  });
}

describe("P1.2 virtual occurrence selector", () => {
  itDb("materializes a one-off virtual occurrence and returns its row id", async () => {
    const start = new Date("2026-07-28T14:00:00.000Z");
    const series = await createActivitySeries(
      userId,
      {
        tz: "UTC",
        dtstartLocal: start,
        rrule: null,
        title: "One-off deep work",
        durationMin: 50,
      },
      { db: env!.db },
    );

    const before = await env!.db
      .select()
      .from(schema.activityOccurrences)
      .where(eq(schema.activityOccurrences.seriesId, series.id));
    expect(before).toHaveLength(0);

    const session = await startFocusSession(
      userId,
      {
        targetDurationMin: 50,
        activitySeriesId: series.id,
        occurrenceKey: series.dtstartLocal,
      },
      { db: env!.db },
    );
    expect(session.activityOccurrenceId).toBeTruthy();
    const occ = await getOccurrence(userId, session.activityOccurrenceId!, {
      db: env!.db,
    });
    expect(occ.seriesId).toBe(series.id);
    expect(occ.occurrenceKey.toISOString()).toBe(start.toISOString());
    expect(occ.status).toBe("pending");
  });

  itDb("materializes a recurring virtual instance without fabricating a UUID", async () => {
    const series = await createActivitySeries(
      userId,
      {
        tz: "UTC",
        dtstartLocal: new Date("2026-07-01T09:00:00.000Z"),
        rrule: "FREQ=DAILY;COUNT=10",
        title: "Daily standup",
        durationMin: 30,
      },
      { db: env!.db },
    );
    const third = expandedKeys(
      series,
      series.dtstartLocal,
      new Date("2026-07-12T00:00:00.000Z"),
    )[2]!;

    const session = await startFocusSession(
      userId,
      {
        targetDurationMin: 30,
        activitySeriesId: series.id,
        occurrenceKey: third.occurrenceKey,
      },
      { db: env!.db },
    );
    const occ = await getOccurrence(userId, session.activityOccurrenceId!, {
      db: env!.db,
    });
    expect(occ.occurrenceKey.toISOString()).toBe(
      third.occurrenceKey.toISOString(),
    );
  });

  itDb("reuses an existing override on repeat start (reschedule preserved)", async () => {
    const series = await createActivitySeries(
      userId,
      {
        tz: "America/New_York",
        dtstartLocal: new Date("2026-08-13T13:00:00.000Z"),
        rrule: null,
        title: "Deep work",
        durationMin: 60,
      },
      { db: env!.db },
    );
    const moved = await upsertOccurrence(
      userId,
      series.id,
      series.dtstartLocal,
      {
        title: "Moved block",
        startAt: new Date("2026-08-14T13:00:00.000Z"),
        durationMin: 60,
      },
      { db: env!.db },
    );

    const first = await startFocusSession(
      userId,
      {
        targetDurationMin: 60,
        activitySeriesId: series.id,
        occurrenceKey: series.dtstartLocal,
      },
      { db: env!.db },
    );
    expect(first.activityOccurrenceId).toBe(moved.id);
    const afterFirst = await getOccurrence(userId, moved.id, { db: env!.db });
    expect(afterFirst.title).toBe("Moved block");
    expect(afterFirst.startAt?.toISOString()).toBe("2026-08-14T13:00:00.000Z");

    const second = await startFocusSession(
      userId,
      {
        targetDurationMin: 25,
        activitySeriesId: series.id,
        occurrenceKey: series.dtstartLocal.toISOString(),
      },
      { db: env!.db },
    );
    expect(second.activityOccurrenceId).toBe(moved.id);
    const afterSecond = await getOccurrence(userId, moved.id, { db: env!.db });
    expect(afterSecond.title).toBe("Moved block");
    expect(afterSecond.revision).toBe(afterFirst.revision);
  });

  itDb("materializes the DST-gap occurrence using the expanded key", async () => {
    // 02:30 America/New_York on 2024-03-10 does not exist; expansion shifts
    // forward to the first valid instant (same fixture as temporal.test.ts).
    const dtstart = wallClockToInstant(
      2024, 2, 9, 2, 30, 0, "America/New_York",
    );
    const series = await createActivitySeries(
      userId,
      {
        tz: "America/New_York",
        dtstartLocal: dtstart,
        rrule: "FREQ=DAILY;COUNT=4",
        title: "Gap block",
        durationMin: 30,
      },
      { db: env!.db },
    );
    const keys = expandedKeys(
      series,
      new Date("2024-03-09T00:00:00.000Z"),
      new Date("2024-03-12T00:00:00.000Z"),
    );
    const gapDay = keys.find((occ) =>
      occ.occurrenceKey.toISOString().startsWith("2024-03-10"),
    );
    expect(gapDay?.occurrenceKey.toISOString()).toBe("2024-03-10T07:30:00.000Z");

    const session = await startFocusSession(
      userId,
      {
        targetDurationMin: 30,
        activitySeriesId: series.id,
        occurrenceKey: gapDay!.occurrenceKey,
      },
      { db: env!.db },
    );
    const occ = await getOccurrence(userId, session.activityOccurrenceId!, {
      db: env!.db,
    });
    expect(occ.occurrenceKey.toISOString()).toBe("2024-03-10T07:30:00.000Z");
  });

  itDb("materializes the DST-fold occurrence using the first-instant key", async () => {
    const dtstart = wallClockToInstant(
      2024, 10, 2, 1, 30, 0, "America/New_York", "first",
    );
    const series = await createActivitySeries(
      userId,
      {
        tz: "America/New_York",
        dtstartLocal: dtstart,
        rrule: "FREQ=DAILY;COUNT=3",
        title: "Fold block",
        durationMin: 30,
      },
      { db: env!.db },
    );
    const keys = expandedKeys(
      series,
      new Date("2024-11-02T00:00:00.000Z"),
      new Date("2024-11-05T00:00:00.000Z"),
    );
    const foldDay = keys.find((occ) =>
      occ.occurrenceKey.toISOString().startsWith("2024-11-03"),
    );
    expect(foldDay?.occurrenceKey.toISOString()).toBe("2024-11-03T05:30:00.000Z");

    const session = await startFocusSession(
      userId,
      {
        targetDurationMin: 30,
        activitySeriesId: series.id,
        occurrenceKey: foldDay!.occurrenceKey,
      },
      { db: env!.db },
    );
    const occ = await getOccurrence(userId, session.activityOccurrenceId!, {
      db: env!.db,
    });
    expect(occ.occurrenceKey.toISOString()).toBe("2024-11-03T05:30:00.000Z");
  });

  itDb("rejects cancelled and skipped occurrences without yielding the session", async () => {
    const series = await createActivitySeries(
      userId,
      {
        tz: "UTC",
        dtstartLocal: new Date("2026-07-20T10:00:00.000Z"),
        rrule: null,
        title: "Cancelled block",
        durationMin: 25,
      },
      { db: env!.db },
    );
    await upsertOccurrence(
      userId,
      series.id,
      series.dtstartLocal,
      { status: "cancelled" },
      { db: env!.db },
    );
    const existing = await startFocusSession(
      userId,
      { targetDurationMin: 25 },
      { db: env!.db },
    );

    await expect(
      startFocusSession(
        userId,
        {
          targetDurationMin: 10,
          activitySeriesId: series.id,
          occurrenceKey: series.dtstartLocal,
        },
        { db: env!.db },
      ),
    ).rejects.toThrow(NotFoundError);

    const active = await getActiveSession(userId, { db: env!.db });
    expect(active?.id).toBe(existing.id);
  });

  itDb("reuses a completed occurrence row without resetting its status", async () => {
    const series = await createActivitySeries(
      userId,
      {
        tz: "UTC",
        dtstartLocal: new Date("2026-07-21T10:00:00.000Z"),
        rrule: null,
        title: "Already done",
        durationMin: 25,
      },
      { db: env!.db },
    );
    const done = await upsertOccurrence(
      userId,
      series.id,
      series.dtstartLocal,
      { status: "completed", completedAt: new Date("2026-07-21T10:30:00.000Z") },
      { db: env!.db },
    );

    const session = await startFocusSession(
      userId,
      {
        targetDurationMin: 25,
        activitySeriesId: series.id,
        occurrenceKey: series.dtstartLocal,
      },
      { db: env!.db },
    );
    expect(session.activityOccurrenceId).toBe(done.id);
    const occ = await getOccurrence(userId, done.id, { db: env!.db });
    expect(occ.status).toBe("completed");
    expect(occ.completedAt?.toISOString()).toBe("2026-07-21T10:30:00.000Z");
  });

  itDb("follows a this_and_future split to the successor series id", async () => {
    const series = await createActivitySeries(
      userId,
      {
        tz: "UTC",
        dtstartLocal: new Date("2026-07-01T09:00:00.000Z"),
        rrule: "FREQ=DAILY;COUNT=10",
        title: "Split source",
        durationMin: 30,
      },
      { db: env!.db },
    );
    const splitKey = new Date("2026-07-05T09:00:00.000Z");
    const split = await editSeriesOccurrence(
      userId,
      series.id,
      splitKey,
      "this_and_future",
      { title: "After split" },
      series.revision,
      { db: env!.db },
    );
    expect(split.seriesId).not.toBe(series.id);

    await expect(
      startFocusSession(
        userId,
        {
          targetDurationMin: 30,
          activitySeriesId: series.id,
          occurrenceKey: splitKey,
        },
        { db: env!.db },
      ),
    ).rejects.toThrow(NotFoundError);

    const session = await startFocusSession(
      userId,
      {
        targetDurationMin: 30,
        activitySeriesId: split.seriesId,
        occurrenceKey: splitKey,
      },
      { db: env!.db },
    );
    const occ = await getOccurrence(userId, session.activityOccurrenceId!, {
      db: env!.db,
    });
    expect(occ.seriesId).toBe(split.seriesId);
    expect(occ.occurrenceKey.toISOString()).toBe(splitKey.toISOString());
  });

  itDb("rejects a deleted parent and a cross-user selector without yielding", async () => {
    const doomed = await createActivitySeries(
      userId,
      {
        tz: "UTC",
        dtstartLocal: new Date("2026-07-22T11:00:00.000Z"),
        rrule: null,
        title: "Doomed",
        durationMin: 20,
      },
      { db: env!.db },
    );
    const existing = await startFocusSession(
      userId,
      { targetDurationMin: 20 },
      { db: env!.db },
    );
    await deleteActivitySeries(userId, doomed.id, doomed.revision, {
      db: env!.db,
    });

    await expect(
      startFocusSession(
        userId,
        {
          targetDurationMin: 15,
          activitySeriesId: doomed.id,
          occurrenceKey: doomed.dtstartLocal,
        },
        { db: env!.db },
      ),
    ).rejects.toThrow(NotFoundError);

    const mallory = crypto.randomUUID();
    await insertUser(env!.db, mallory, `mallory-virtual-${mallory}@test.com`);
    const foreign = await createActivitySeries(
      mallory,
      {
        tz: "UTC",
        dtstartLocal: new Date("2026-07-23T11:00:00.000Z"),
        rrule: "FREQ=DAILY;COUNT=3",
        title: "Mallory series",
        durationMin: 20,
      },
      { db: env!.db },
    );

    await expect(
      startFocusSession(
        userId,
        {
          targetDurationMin: 15,
          activitySeriesId: foreign.id,
          occurrenceKey: foreign.dtstartLocal,
        },
        { db: env!.db },
      ),
    ).rejects.toThrow(NotFoundError);

    const active = await getActiveSession(userId, { db: env!.db });
    expect(active?.id).toBe(existing.id);
    const leaked = await env!.db
      .select()
      .from(schema.activityOccurrences)
      .where(eq(schema.activityOccurrences.seriesId, foreign.id));
    expect(leaked).toHaveLength(0);
  });

  itDb("rejects an unknown key and a race-deleted series without materializing", async () => {
    const series = await createActivitySeries(
      userId,
      {
        tz: "UTC",
        dtstartLocal: new Date("2026-07-24T12:00:00.000Z"),
        rrule: "FREQ=DAILY;COUNT=3",
        title: "Still live",
        durationMin: 20,
      },
      { db: env!.db },
    );
    const existing = await startFocusSession(
      userId,
      { targetDurationMin: 20 },
      { db: env!.db },
    );

    await expect(
      startFocusSession(
        userId,
        {
          targetDurationMin: 10,
          activitySeriesId: series.id,
          occurrenceKey: new Date("2026-08-01T12:00:00.000Z"),
        },
        { db: env!.db },
      ),
    ).rejects.toThrow(NotFoundError);

    await expect(
      startFocusSession(
        userId,
        {
          targetDurationMin: 10,
          activitySeriesId: series.id,
        },
        { db: env!.db },
      ),
    ).rejects.toThrow(BadRequestError);

    await deleteActivitySeries(userId, series.id, series.revision, {
      db: env!.db,
    });
    await expect(
      startFocusSession(
        userId,
        {
          targetDurationMin: 10,
          activitySeriesId: series.id,
          occurrenceKey: series.dtstartLocal,
        },
        { db: env!.db },
      ),
    ).rejects.toThrow(NotFoundError);

    const rows = await env!.db
      .select()
      .from(schema.activityOccurrences)
      .where(
        and(
          eq(schema.activityOccurrences.seriesId, series.id),
          eq(schema.activityOccurrences.userId, userId),
        ),
      );
    expect(rows.filter((row) => !row.deletedAt)).toHaveLength(0);
    const active = await getActiveSession(userId, { db: env!.db });
    expect(active?.id).toBe(existing.id);
  });
});
