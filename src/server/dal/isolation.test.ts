/**
 * SEC-01 cross-user isolation — the surfaces dal.test.ts does not cover.
 *
 * dal.test.ts pins tasks and the change log. Everything else in the DAL was
 * unguarded by tests: dropping `eq(table.userId, userId)` from getActivitySeries,
 * getRoutine, listCategories, listOccurrences or updateSettings would have kept
 * the suite green while leaking another account's planner.
 *
 * Cross-user reads must raise NotFoundError (404, not 403) so ids stay
 * non-enumerable.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createEphemeralDb,
  insertUser,
  rethrowIfMigrationFailure,
  type EphemeralDb,
} from "../db/test-db";
import {
  createActivitySeries,
  getActivitySeries,
  listActivitySeries,
  listOccurrences,
  createRoutine,
  getRoutine,
  updateRoutine,
  deleteRoutine,
  listRoutineSteps,
  listCategories,
  getOrCreateSettings,
  updateSettings,
  createTag,
  getTag,
  NotFoundError,
} from "./index";

let env: EphemeralDb | null = null;
let dbAvailable = false;
let alice = "alice";
let mallory = "mallory";

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
    alice = crypto.randomUUID();
    mallory = crypto.randomUUID();
    await insertUser(env.db, alice, "alice@test.com");
    await insertUser(env.db, mallory, "mallory@test.com");
  } catch (e) {
    rethrowIfMigrationFailure(e);
    dbAvailable = false;
  }
}, 60000);

afterAll(async () => {
  if (env) await env.teardown();
}, 60000);

/** Skip (not pass) when Postgres is unavailable — honest CI signal. */
const itDb = (name: string, fn: (e: EphemeralDb) => Promise<void> | void) =>
  it(name, async ({ skip }) => {
    if (!dbAvailable || !env) {
      console.warn(`[SKIP] ${name}: Postgres unavailable`);
      skip(true, "Postgres unavailable");
      return;
    }
    await fn(env);
  });

const future = () => new Date(Date.now() + 60 * 60 * 1000);

async function aliceSeries(e: EphemeralDb) {
  return createActivitySeries(
    alice,
    {
      tz: "America/New_York",
      dtstartLocal: future(),
      rrule: null,
      title: "Alice's deep work",
      durationMin: 50,
    },
    { db: e.db },
  );
}

async function aliceRoutine(e: EphemeralDb) {
  return createRoutine(
    alice,
    {
      title: "Alice's morning",
      steps: [{ title: "Water", durationMin: 5 }],
      schedule: { tz: "America/New_York", rrule: "FREQ=DAILY" },
    },
    { db: e.db },
  );
}

describe("SEC-01: activity series are scoped to their owner", () => {
  itDb("mallory cannot read alice's series", async (e) => {
    const series = await aliceSeries(e);
    await expect(
      getActivitySeries(mallory, series.id, { db: e.db }),
    ).rejects.toThrow(NotFoundError);
  });

  itDb("mallory's list never contains alice's series", async (e) => {
    const series = await aliceSeries(e);
    const mine = await listActivitySeries(mallory, { db: e.db });
    expect(mine.map((s) => s.id)).not.toContain(series.id);
  });

  itDb("mallory cannot enumerate occurrences of alice's series", async (e) => {
    const series = await aliceSeries(e);
    await expect(
      listOccurrences(mallory, series.id, { db: e.db }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("SEC-01: routines are scoped to their owner", () => {
  itDb("mallory cannot read alice's routine", async (e) => {
    const routine = await aliceRoutine(e);
    await expect(getRoutine(mallory, routine.id, { db: e.db })).rejects.toThrow(
      NotFoundError,
    );
  });

  itDb("mallory cannot update alice's routine", async (e) => {
    const routine = await aliceRoutine(e);
    await expect(
      updateRoutine(mallory, routine.id, { title: "pwned" }, routine.revision, {
        db: e.db,
      }),
    ).rejects.toThrow(NotFoundError);
    const still = await getRoutine(alice, routine.id, { db: e.db });
    expect(still.title).toBe("Alice's morning");
  });

  itDb("mallory cannot delete alice's routine", async (e) => {
    const routine = await aliceRoutine(e);
    await expect(
      deleteRoutine(mallory, routine.id, routine.revision, { db: e.db }),
    ).rejects.toThrow(NotFoundError);
    const still = await getRoutine(alice, routine.id, { db: e.db });
    expect(still.deletedAt).toBeNull();
  });

  itDb("mallory cannot list steps of alice's routine", async (e) => {
    const routine = await aliceRoutine(e);
    await expect(
      listRoutineSteps(mallory, routine.id, { db: e.db }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("SEC-01: categories, tags and settings are scoped to their owner", () => {
  itDb("each user sees only their own seeded categories", async (e) => {
    const hers = await listCategories(alice, { db: e.db });
    const his = await listCategories(mallory, { db: e.db });
    expect(hers.length).toBeGreaterThan(0);
    expect(his.length).toBeGreaterThan(0);
    const overlap = hers
      .map((c) => c.id)
      .filter((id) => his.some((c) => c.id === id));
    expect(overlap).toEqual([]);
    expect(hers.every((c) => c.userId === alice)).toBe(true);
    expect(his.every((c) => c.userId === mallory)).toBe(true);
  });

  itDb("mallory cannot read alice's tag", async (e) => {
    const tag = await createTag(alice, { name: "private", color: "iris" }, { db: e.db });
    await expect(getTag(mallory, tag.id, { db: e.db })).rejects.toThrow(
      NotFoundError,
    );
  });

  itDb("updating settings never touches another user's row", async (e) => {
    const hers = await getOrCreateSettings(alice, { db: e.db });
    const his = await getOrCreateSettings(mallory, { db: e.db });
    expect(his.timezone).toBe("UTC");

    await updateSettings(
      alice,
      { timezone: "America/New_York" },
      hers.revision,
      { db: e.db },
    );

    const hisAfter = await getOrCreateSettings(mallory, { db: e.db });
    expect(hisAfter.timezone).toBe("UTC");
    const hersAfter = await getOrCreateSettings(alice, { db: e.db });
    expect(hersAfter.timezone).toBe("America/New_York");
  });

  itDb("an invalid timezone is rejected before it can poison the planner", async (e) => {
    // The API schema refuses this now; the seed path guards separately. If a bad
    // zone ever lands in the column, every later day/search read throws
    // RangeError -> 500 until it is patched back.
    const seeded = await getOrCreateSettings(mallory, {
      db: e.db,
      timezoneHint: "Not/AZone",
    });
    expect(seeded.timezone).toBe("UTC");
  });
});
