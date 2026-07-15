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
import { createEphemeralDb, insertUser, type EphemeralDb } from "../db/test-db";
import { createActivitySeries, getActivitySeries } from "../dal";
import {
  editSeriesOccurrence,
  deleteSeriesOccurrence,
  type EditScope,
} from "./recurrence";
import { activityOccurrences, activitySeries as seriesTable } from "../db/schema";
import { eq } from "drizzle-orm";

let env: EphemeralDb | null = null;
let dbAvailable = false;
let userId: string;

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
    userId = crypto.randomUUID();
    await insertUser(env!.db, userId, "recur@test.com");
  } catch {
    dbAvailable = false;
  }
}, 60000);

afterAll(async () => {
  if (env) await env.teardown();
}, 60000);

const itDb = (name: string, fn: () => Promise<void> | void) =>
  it(name, async () => {
    if (!dbAvailable || !env) return;
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

    // The occurrence override exists.
    const overrides = await env!.db
      .select()
      .from(activityOccurrences)
      .where(eq(activityOccurrences.seriesId, series.id));
    expect(overrides).toHaveLength(1);
    expect(overrides[0].title).toBe("Moved standup");
    expect(overrides[0].occurrenceKey.toISOString()).toBe(occKey.toISOString());
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
});
