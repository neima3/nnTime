/**
 * Recurrence edit-scope tests — ADR-001 (Phase 2A).
 *
 * Verifies the three edit scopes:
 *  - this: occurrence override only, master untouched
 *  - this_and_future: series split, occurrence_key survives
 *  - all: master update
 * Plus delete scopes mirroring edit scopes.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEphemeralDb, rethrowIfMigrationFailure, insertUser, type EphemeralDb } from "../db/test-db";
import { createActivitySeries, getActivitySeries, NotFoundError } from "../dal";
import {
  editSeriesOccurrence,
  deleteSeriesOccurrence,
} from "./recurrence";
import {
  activityOccurrences,
  activitySeries as seriesTable,
  categories,
  changeLog,
  tags,
} from "../db/schema";
import { and, asc, eq } from "drizzle-orm";

let env: EphemeralDb | null = null;
let dbAvailable = false;
let userId: string;

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
    userId = crypto.randomUUID();
    await insertUser(env!.db, userId, "recur@test.com");
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

describe("ADR-001 edit scope: this occurrence", () => {
  itDb("patches the occurrence override; master untouched", async () => {
    const series = await createActivitySeries(
      userId,
      {
        tz: "UTC",
        dtstartLocal: new Date("2024-01-01T09:00:00Z"),
        rrule: "FREQ=DAILY;COUNT=10",
        title: "Daily standup",
        durationMin: 30,
      },
      { db: env!.db },
    );

    const occKey = new Date("2024-01-03T09:00:00Z");
    await editSeriesOccurrence(userId, series.id, occKey, "this", {
      title: "Moved standup",
    }, series.revision, { db: env!.db });

    // Master is untouched.
    const master = await getActivitySeries(userId, series.id, { db: env!.db });
    expect(master.title).toBe("Daily standup");
    expect(master.revision).toBe(series.revision + 1);

    // The occurrence override exists.
    const overrides = await env!.db
      .select()
      .from(activityOccurrences)
      .where(eq(activityOccurrences.seriesId, series.id));
    expect(overrides).toHaveLength(1);
    expect(overrides[0].title).toBe("Moved standup");
    expect(overrides[0].occurrenceKey.toISOString()).toBe(occKey.toISOString());
  });

  itDb("conflicts a second occurrence edit that reuses the same revision", async () => {
    const series = await createActivitySeries(userId, {
      tz: "UTC",
      dtstartLocal: new Date("2026-08-01T09:00:00.000Z"),
      rrule: "FREQ=DAILY;COUNT=5",
      title: "Concurrency guard",
      durationMin: 30,
    }, { db: env!.db });
    const occurrenceKey = new Date("2026-08-02T09:00:00.000Z");
    await editSeriesOccurrence(userId, series.id, occurrenceKey, "this", { title: "First" }, series.revision, { db: env!.db });
    await expect(editSeriesOccurrence(userId, series.id, occurrenceKey, "this", { title: "Second" }, series.revision, { db: env!.db })).rejects.toThrow("revision mismatch");
  });
});

describe("ADR-001 edit scope: this and future (series split)", () => {
  itDb("creates a new series at the split point; occurrence_key preserved", async () => {
    const series = await createActivitySeries(
      userId,
      {
        tz: "UTC",
        dtstartLocal: new Date("2024-01-01T09:00:00Z"),
        rrule: "FREQ=DAILY;COUNT=30",
        title: "Old routine",
        durationMin: 45,
      },
      { db: env!.db },
    );

    const splitKey = new Date("2024-01-10T09:00:00Z");
    await editSeriesOccurrence(userId, series.id, splitKey, "this_and_future", {
      title: "New routine",
      durationMin: 60,
    }, series.revision, { db: env!.db });

    // Old series is truncated (has UNTIL now).
    const oldMaster = await getActivitySeries(userId, series.id, { db: env!.db });
    expect(oldMaster.rrule).toContain("UNTIL=");

    // A new series exists starting at the split point with the new title.
    const allSeries = await env!.db
      .select()
      .from(seriesTable)
      .where(eq(seriesTable.userId, userId));
    // The new series should have "New routine" title.
    const newSeries = allSeries.find((s: { title: string }) => s.title === "New routine");
    expect(newSeries).toBeDefined();
    expect(newSeries!.durationMin).toBe(60);
  });

  itDb("inherits the complete master, returns the successor, logs both masters, and preserves occurrence identity", async () => {
    const categoryId = crypto.randomUUID();
    const tagId = crypto.randomUUID();
    await env!.db.insert(categories).values({
      id: categoryId,
      userId,
      key: `canonical-${categoryId}`,
      label: "Canonical",
    });
    await env!.db.insert(tags).values({
      id: tagId,
      userId,
      name: `Canonical ${tagId}`,
    });
    const checklistTemplate = [{ label: "Preserve me", done: true }];
    const series = await createActivitySeries(
      userId,
      {
        tz: "America/New_York",
        dtstartLocal: new Date("2026-08-01T13:00:00.000Z"),
        rrule: "FREQ=DAILY;COUNT=30",
        exdate: [new Date("2026-08-03T00:00:00.000Z")],
        rdate: [new Date("2026-08-04T13:00:00.000Z")],
        title: "Original title",
        emoji: "🧭",
        categoryId,
        durationMin: 45,
        checklistTemplate,
        energy: "high",
        priority: "high",
        tags: [tagId],
        notes: "Preserve every field",
        source: "routine",
        sourceRef: "template-42",
      },
      { db: env!.db },
    );
    const splitKey = new Date("2026-08-05T13:00:00.000Z");
    const overrideId = crypto.randomUUID();
    await env!.db.insert(activityOccurrences).values({
      id: overrideId,
      userId,
      seriesId: series.id,
      occurrenceKey: splitKey,
      title: "Occurrence override",
    });

    const result = await editSeriesOccurrence(
      userId,
      series.id,
      splitKey,
      "this_and_future",
      { title: "Updated title", priority: "low" },
      series.revision,
      { db: env!.db },
    );

    expect(result).toMatchObject({
      seriesId: expect.any(String),
      revision: 1,
    });
    expect(result.seriesId).not.toBe(series.id);
    const successor = await getActivitySeries(userId, result.seriesId, {
      db: env!.db,
    });
    expect(successor).toMatchObject({
      id: result.seriesId,
      tz: "America/New_York",
      dtstartLocal: splitKey,
      rrule: "FREQ=DAILY;COUNT=26",
      exdate: [new Date("2026-08-03T00:00:00.000Z")],
      rdate: [],
      title: "Updated title",
      emoji: "🧭",
      categoryId,
      durationMin: 45,
      checklistTemplate,
      energy: "high",
      priority: "low",
      tags: [tagId],
      notes: "Preserve every field",
      source: "routine",
      sourceRef: "template-42",
      revision: 1,
    });

    const [movedOverride] = await env!.db
      .select()
      .from(activityOccurrences)
      .where(eq(activityOccurrences.id, overrideId));
    expect(movedOverride).toMatchObject({
      seriesId: result.seriesId,
      occurrenceKey: splitKey,
      title: "Occurrence override",
    });

    const changes = await env!.db
      .select()
      .from(changeLog)
      .where(
        and(
          eq(changeLog.userId, userId),
          eq(changeLog.entityType, "activity_series"),
        ),
      )
      .orderBy(asc(changeLog.id));
    expect(changes.filter((entry) => entry.entityId === series.id).at(-1)).toMatchObject({
      op: "upsert",
      revision: 2,
    });
    expect(changes.filter((entry) => entry.entityId === result.seriesId)).toEqual([
      expect.objectContaining({ op: "upsert", revision: 1 }),
    ]);
  });

  itDb("partitions RDATE values across the split without duplicating them", async () => {
    const before = new Date("2026-08-02T13:00:00.000Z");
    const after = new Date("2026-08-08T13:00:00.000Z");
    const series = await createActivitySeries(userId, {
      tz: "UTC",
      dtstartLocal: new Date("2026-08-01T13:00:00.000Z"),
      rrule: "FREQ=DAILY;COUNT=10",
      rdate: [before, after],
      title: "Partition dates",
      durationMin: 30,
    }, { db: env!.db });

    const result = await editSeriesOccurrence(userId, series.id, new Date("2026-08-05T13:00:00.000Z"), "this_and_future", {}, series.revision, { db: env!.db });
    const predecessor = await getActivitySeries(userId, series.id, { db: env!.db });
    const successor = await getActivitySeries(userId, result.seriesId, { db: env!.db });
    expect(predecessor.rdate).toEqual([before]);
    expect(successor.rdate).toEqual([after]);
  });

  itDb("rejects arbitrary split keys and edits to imported calendar series", async () => {
    const recurring = await createActivitySeries(userId, {
      tz: "UTC",
      dtstartLocal: new Date("2026-08-01T13:00:00.000Z"),
      rrule: "FREQ=DAILY;COUNT=10",
      title: "Validate key",
      durationMin: 30,
    }, { db: env!.db });
    await expect(editSeriesOccurrence(userId, recurring.id, new Date("2026-08-05T13:00:01.000Z"), "this_and_future", {}, recurring.revision, { db: env!.db })).rejects.toThrow("occurrence key");

    const imported = await createActivitySeries(userId, {
      tz: "UTC",
      dtstartLocal: new Date("2026-08-01T13:00:00.000Z"),
      rrule: null,
      title: "Imported",
      durationMin: 30,
      source: "calendar",
      sourceRef: "provider-event",
    }, { db: env!.db });
    await expect(editSeriesOccurrence(userId, imported.id, imported.dtstartLocal, "all", { title: "Changed" }, imported.revision, { db: env!.db })).rejects.toThrow("read-only");
  });

  itDb("rejects a split at an EXDATE-excluded occurrence", async () => {
    const series = await createActivitySeries(userId, {
      tz: "America/New_York",
      dtstartLocal: new Date("2026-08-01T13:00:00.000Z"),
      rrule: "FREQ=DAILY;COUNT=10",
      exdate: [new Date("2026-08-05T00:00:00.000Z")],
      title: "Excluded split",
      durationMin: 30,
    }, { db: env!.db });
    await expect(editSeriesOccurrence(
      userId,
      series.id,
      new Date("2026-08-05T13:00:00.000Z"),
      "this_and_future",
      {},
      series.revision,
      { db: env!.db },
    )).rejects.toThrow("occurrence key");
  });

  itDb("atomically rejects cross-owner category and tag references for master edits and splits", async () => {
    const otherUserId = crypto.randomUUID();
    await insertUser(env!.db, otherUserId, "recur-other@test.com");
    const foreignCategoryId = crypto.randomUUID();
    const foreignTagId = crypto.randomUUID();
    await env!.db.insert(categories).values({
      id: foreignCategoryId,
      userId: otherUserId,
      key: "foreign-category",
      label: "Foreign",
    });
    await env!.db.insert(tags).values({
      id: foreignTagId,
      userId: otherUserId,
      name: "Foreign tag",
    });

    for (const scope of ["all", "this_and_future"] as const) {
      for (const patch of [
        { categoryId: foreignCategoryId },
        { tags: [foreignTagId] },
      ]) {
        const series = await createActivitySeries(
          userId,
          {
            tz: "UTC",
            dtstartLocal: new Date("2026-08-01T09:00:00.000Z"),
            rrule: "FREQ=DAILY;COUNT=10",
            title: "Ownership boundary",
            durationMin: 30,
          },
          { db: env!.db },
        );
        const beforeSeries = await env!.db
          .select()
          .from(seriesTable)
          .where(eq(seriesTable.userId, userId));
        const beforeChanges = await env!.db
          .select()
          .from(changeLog)
          .where(eq(changeLog.userId, userId));

        await expect(
          editSeriesOccurrence(
            userId,
            series.id,
            new Date("2026-08-05T09:00:00.000Z"),
            scope,
            patch,
            series.revision,
            { db: env!.db },
          ),
        ).rejects.toBeInstanceOf(NotFoundError);

        const afterSeries = await env!.db
          .select()
          .from(seriesTable)
          .where(eq(seriesTable.userId, userId));
        const afterChanges = await env!.db
          .select()
          .from(changeLog)
          .where(eq(changeLog.userId, userId));
        const unchanged = afterSeries.find((row) => row.id === series.id);
        expect(unchanged).toMatchObject({
          revision: series.revision,
          rrule: series.rrule,
          categoryId: series.categoryId,
          tags: series.tags,
        });
        expect(afterSeries).toHaveLength(beforeSeries.length);
        expect(afterChanges).toHaveLength(beforeChanges.length);
      }
    }
  });
});

describe("ADR-001 edit scope: all (master update)", () => {
  itDb("updates the master series row", async () => {
    const series = await createActivitySeries(
      userId,
      {
        tz: "UTC",
        dtstartLocal: new Date("2024-01-01T09:00:00Z"),
        rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR",
        title: "Gym",
        durationMin: 75,
      },
      { db: env!.db },
    );

    await editSeriesOccurrence(userId, series.id, new Date("2024-01-01T09:00:00Z"), "all", {
      title: "Gym session",
      durationMin: 90,
    }, series.revision, { db: env!.db });

    const master = await getActivitySeries(userId, series.id, { db: env!.db });
    expect(master.title).toBe("Gym session");
    expect(master.durationMin).toBe(90);
  });
});

describe("ADR-001 delete scope: this occurrence", () => {
  itDb("cancels the single occurrence", async () => {
    const series = await createActivitySeries(
      userId,
      {
        tz: "UTC",
        dtstartLocal: new Date("2024-01-01T09:00:00Z"),
        rrule: "FREQ=DAILY;COUNT=5",
        title: "Cancel test",
        durationMin: 30,
      },
      { db: env!.db },
    );

    const occKey = new Date("2024-01-02T09:00:00Z");
    await deleteSeriesOccurrence(userId, series.id, occKey, "this", series.revision, {
      db: env!.db,
    });

    // An override with status=cancelled exists.
    const overrides = await env!.db
      .select()
      .from(activityOccurrences)
      .where(eq(activityOccurrences.seriesId, series.id));
    expect(overrides).toHaveLength(1);
    expect(overrides[0].status).toBe("cancelled");
  });

  itDb("truncates this and future without creating a successor", async () => {
    const series = await createActivitySeries(userId, {
      tz: "UTC",
      dtstartLocal: new Date("2026-08-01T09:00:00.000Z"),
      rrule: "FREQ=DAILY;COUNT=10",
      rdate: [new Date("2026-08-03T09:00:00.000Z"), new Date("2026-08-08T09:00:00.000Z")],
      title: "Truncate only",
      durationMin: 30,
    }, { db: env!.db });
    const before = await env!.db.select().from(seriesTable).where(eq(seriesTable.userId, userId));
    await deleteSeriesOccurrence(userId, series.id, new Date("2026-08-05T09:00:00.000Z"), "this_and_future", series.revision, { db: env!.db });
    const after = await env!.db.select().from(seriesTable).where(eq(seriesTable.userId, userId));
    const updated = await getActivitySeries(userId, series.id, { db: env!.db });
    expect(after).toHaveLength(before.length);
    expect(updated.rrule).toContain("UNTIL=20260805T085959Z");
    expect(updated.rdate).toEqual([new Date("2026-08-03T09:00:00.000Z")]);
    expect(updated.revision).toBe(series.revision + 1);
  });
});
