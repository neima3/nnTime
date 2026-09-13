/**
 * P3.1 — a rebased status change must not clobber a concurrent title edit.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createEphemeralDb,
  insertUser,
  rethrowIfMigrationFailure,
  type EphemeralDb,
} from "../db/test-db";
import { createActivitySeries, listActivitySeries, listUserOccurrences } from "../dal";
import { editSeriesOccurrence } from "./recurrence";
import { expandActivitiesForDay } from "./day";
import { resolveDayBounds } from "../temporal/zone";

let env: EphemeralDb | null = null;
let dbAvailable = false;
let userId: string;

const ZONE = "America/New_York";
const DAY = "2026-09-14";
const OCCURRENCE = new Date("2026-09-14T14:00:00.000Z");

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
    userId = crypto.randomUUID();
    await insertUser(env.db, userId, "p31-status-title@test.com");
  } catch (e) {
    rethrowIfMigrationFailure(e);
    dbAvailable = false;
  }
}, 60_000);

afterAll(async () => {
  if (env) await env.teardown();
}, 60_000);

const itDb = (name: string, fn: () => Promise<void> | void) =>
  it(name, async ({ skip }) => {
    if (!dbAvailable || !env) {
      console.warn(`[SKIP] ${name}: Postgres unavailable`);
      skip(true, "Postgres unavailable");
      return;
    }
    await fn();
  });

describe("P3.1 status replay vs second-device title", () => {
  itDb("keeps the concurrent title and applies only the status field group", async () => {
    const series = await createActivitySeries(
      userId,
      {
        tz: ZONE,
        dtstartLocal: OCCURRENCE,
        title: "Original title",
        durationMin: 30,
        notes: "do not clobber",
      },
      { db: env!.db },
    );

    await editSeriesOccurrence(
      userId,
      series.id,
      OCCURRENCE,
      "this",
      { title: "Second device title" },
      series.revision,
      { db: env!.db },
    );
    const afterTitle = (await listActivitySeries(userId, { db: env!.db })).find(
      (row) => row.id === series.id,
    )!;

    await editSeriesOccurrence(
      userId,
      series.id,
      OCCURRENCE,
      "this",
      {
        status: "completed",
        completedAt: new Date("2026-09-14T15:10:00.000Z"),
      },
      afterTitle.revision,
      { db: env!.db },
    );

    const day = expandActivitiesForDay(
      await listActivitySeries(userId, { db: env!.db }),
      await listUserOccurrences(userId, { db: env!.db }),
      resolveDayBounds(DAY, ZONE),
    ).find((activity) => activity.id === series.id);

    expect(day?.title).toBe("Second device title");
    expect(day?.status).toBe("completed");
    expect(day?.durationMin).toBe(30);
    const master = (await listActivitySeries(userId, { db: env!.db })).find(
      (row) => row.id === series.id,
    );
    expect(master?.notes).toBe("do not clobber");
  });
});
