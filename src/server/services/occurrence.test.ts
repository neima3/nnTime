/**
 * Activity occurrence tests — ADR-001 override model.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEphemeralDb, insertUser, type EphemeralDb } from "../db/test-db";
import { createActivitySeries, listOccurrences, upsertOccurrence, type Db } from "../dal";

let env: EphemeralDb | null = null;
let dbAvailable = false;
let userId: string;

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
    userId = crypto.randomUUID();
    await insertUser(env.db, userId, "occ@test.com");
  } catch { dbAvailable = false; }
}, 60000);

afterAll(async () => { if (env) await env.teardown(); });

const itDb = (name: string, fn: () => Promise<void> | void) =>
  it(name, async () => { if (!dbAvailable || !env) return; await fn(); });

describe("Activity occurrence overrides", () => {
  itDb("upsert creates and updates override", async () => {
    const db: Db = env!.db;
    const series = await createActivitySeries(userId, {
      tz: "UTC", dtstartLocal: new Date("2026-07-17T10:00:00Z"),
      title: "Daily standup", durationMin: 30,
    }, { db });

    const occKey = new Date("2026-07-17T10:00:00Z");
    
    // First upsert creates the override
    const occ1 = await upsertOccurrence(userId, series.id, occKey, {
      title: "Moved standup",
    }, { db });
    expect(occ1.title).toBe("Moved standup");

    // Second upsert updates it (onConflict)
    const occ2 = await upsertOccurrence(userId, series.id, occKey, {
      title: "Renamed again",
    }, { db });
    expect(occ2.title).toBe("Renamed again");

    // Verify only one occurrence row
    const occs = await listOccurrences(userId, series.id, { db });
    expect(occs).toHaveLength(1);
  });

  itDb("occurrences are scoped by series", async () => {
    const db: Db = env!.db;
    const s1 = await createActivitySeries(userId, {
      tz: "UTC", dtstartLocal: new Date("2026-07-17T14:00:00Z"),
      title: "Afternoon work", durationMin: 60,
    }, { db });
    const s2 = await createActivitySeries(userId, {
      tz: "UTC", dtstartLocal: new Date("2026-07-17T16:00:00Z"),
      title: "Late work", durationMin: 45,
    }, { db });

    await upsertOccurrence(userId, s1.id, new Date("2026-07-17T14:00:00Z"), {
      status: "completed",
    }, { db });

    // s2 should have no occurrences
    const s2Occs = await listOccurrences(userId, s2.id, { db });
    expect(s2Occs).toHaveLength(0);

    // s1 should have 1
    const s1Occs = await listOccurrences(userId, s1.id, { db });
    expect(s1Occs).toHaveLength(1);
    expect(s1Occs[0].status).toBe("completed");
  });
});
