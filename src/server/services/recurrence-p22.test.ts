/**
 * P2.2 — recurrence scopes vs neighboring days, completed history, and
 * two-client conflicts. Day expansion is the evidence, not just the PATCH body.
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
  listActivitySeries,
  listUserOccurrences,
  upsertOccurrence,
} from "../dal";
import { activityOccurrences, plannerEvents } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { ConflictError } from "../dal";
import { editSeriesOccurrence } from "./recurrence";
import { expandActivitiesForDay } from "./day";
import { resolveDayBounds } from "../temporal/zone";

let env: EphemeralDb | null = null;
let dbAvailable = false;
let userId: string;

const ZONE = "America/New_York";
const DAYS = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17"] as const;
const at10 = (day: string) => new Date(`${day}T14:00:00.000Z`);

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
    userId = crypto.randomUUID();
    await insertUser(env.db, userId, "p22-recur@test.com");
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

async function titlesOn(day: string): Promise<string[]> {
  const [seriesList, occurrences] = await Promise.all([
    listActivitySeries(userId, { db: env!.db }),
    listUserOccurrences(userId, { db: env!.db }),
  ]);
  return expandActivitiesForDay(
    seriesList,
    occurrences,
    resolveDayBounds(day, ZONE),
  ).map((a) => a.title);
}

async function statusesOn(day: string): Promise<Record<string, string>> {
  const [seriesList, occurrences] = await Promise.all([
    listActivitySeries(userId, { db: env!.db }),
    listUserOccurrences(userId, { db: env!.db }),
  ]);
  const out: Record<string, string> = {};
  for (const a of expandActivitiesForDay(
    seriesList,
    occurrences,
    resolveDayBounds(day, ZONE),
  )) {
    out[a.title] = a.status;
  }
  return out;
}

async function daily(title: string, notes = "keep these notes") {
  return createActivitySeries(
    userId,
    {
      tz: ZONE,
      dtstartLocal: at10(DAYS[0]),
      rrule: "FREQ=DAILY;COUNT=8",
      title,
      durationMin: 30,
      notes,
    },
    { db: env!.db },
  );
}

describe("P2.2 completed history survives series edits", () => {
  itDb("editScope=all keeps a completed past day and its history row", async () => {
    const series = await daily("History all");
    const pastKey = at10(DAYS[0]);
    const completedAt = new Date("2026-09-14T15:00:00.000Z");
    await upsertOccurrence(
      userId,
      series.id,
      pastKey,
      { status: "completed", completedAt },
      { db: env!.db },
    );
    await env!.db.insert(plannerEvents).values({
      id: crypto.randomUUID(),
      userId,
      entityType: "activity_series",
      entityId: series.id,
      eventType: "complete",
      payload: { occurrenceKey: pastKey.toISOString() },
      occurredAt: completedAt,
      tz: ZONE,
    });

    await editSeriesOccurrence(
      userId,
      series.id,
      at10(DAYS[2]),
      "all",
      { title: "History all (renamed)" },
      series.revision,
      { db: env!.db },
    );

    expect(await titlesOn(DAYS[0])).toContain("History all");
    expect(await titlesOn(DAYS[0])).not.toContain("History all (renamed)");
    expect((await statusesOn(DAYS[0]))["History all"]).toBe("completed");
    expect(await titlesOn(DAYS[2])).toContain("History all (renamed)");

    const [occ] = await env!.db
      .select()
      .from(activityOccurrences)
      .where(
        and(
          eq(activityOccurrences.seriesId, series.id),
          eq(activityOccurrences.status, "completed"),
        ),
      );
    expect(occ.completedAt?.toISOString()).toBe(completedAt.toISOString());
    expect(occ.title).toBe("History all");

    const events = await env!.db
      .select()
      .from(plannerEvents)
      .where(eq(plannerEvents.userId, userId));
    expect(
      events.filter(
        (e) =>
          e.eventType === "complete" &&
          (e.payload as { occurrenceKey?: string }).occurrenceKey ===
            pastKey.toISOString(),
      ),
    ).toHaveLength(1);
  });

  itDb("this_and_future leaves completed days before the split on the old title", async () => {
    const series = await daily("History future");
    await upsertOccurrence(
      userId,
      series.id,
      at10(DAYS[0]),
      { status: "completed", completedAt: new Date("2026-09-14T15:05:00.000Z") },
      { db: env!.db },
    );

    await editSeriesOccurrence(
      userId,
      series.id,
      at10(DAYS[2]),
      "this_and_future",
      { title: "History future (after)" },
      series.revision,
      { db: env!.db },
    );

    expect(await titlesOn(DAYS[0])).toContain("History future");
    expect((await statusesOn(DAYS[0]))["History future"]).toBe("completed");
    expect(await titlesOn(DAYS[1])).toContain("History future");
    expect(await titlesOn(DAYS[2])).toContain("History future (after)");
    expect(await titlesOn(DAYS[3])).toContain("History future (after)");
  });
});

describe("P2.2 two clients / stale revision", () => {
  itDb("a stale second writer conflicts and leaves unrelated fields intact", async () => {
    const series = await daily("Conflict pin", "do not clobber");
    const key = at10(DAYS[1]);

    await editSeriesOccurrence(
      userId,
      series.id,
      key,
      "this",
      { title: "Conflict pin (A)" },
      series.revision,
      { db: env!.db },
    );

    await expect(
      editSeriesOccurrence(
        userId,
        series.id,
        key,
        "this",
        { durationMin: 90, title: "Conflict pin (B)" },
        series.revision,
        { db: env!.db },
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(await titlesOn(DAYS[1])).toContain("Conflict pin (A)");
    expect(await titlesOn(DAYS[1])).not.toContain("Conflict pin (B)");
    const [seriesList, occurrences] = await Promise.all([
      listActivitySeries(userId, { db: env!.db }),
      listUserOccurrences(userId, { db: env!.db }),
    ]);
    const day = expandActivitiesForDay(
      seriesList,
      occurrences,
      resolveDayBounds(DAYS[1], ZONE),
    ).find((a) => a.title === "Conflict pin (A)");
    expect(day?.durationMin).toBe(30);
    const master = seriesList.find((s) => s.id === series.id);
    expect(master?.notes).toBe("do not clobber");
    expect(master?.revision).toBe(series.revision + 1);

    await editSeriesOccurrence(
      userId,
      series.id,
      key,
      "this",
      { durationMin: 90 },
      master!.revision,
      { db: env!.db },
    );
    const after = expandActivitiesForDay(
      await listActivitySeries(userId, { db: env!.db }),
      await listUserOccurrences(userId, { db: env!.db }),
      resolveDayBounds(DAYS[1], ZONE),
    ).find((a) => a.title === "Conflict pin (A)");
    expect(after?.durationMin).toBe(90);
    expect(after?.title).toBe("Conflict pin (A)");
  });

  itDb("stale this_and_future and all edits refuse to write", async () => {
    const series = await daily("Stale wider");
    await expect(
      editSeriesOccurrence(
        userId,
        series.id,
        at10(DAYS[2]),
        "this_and_future",
        { title: "Should not land" },
        series.revision - 1 + 0,
        { db: env!.db },
      ),
    ).rejects.toThrow("revision mismatch");

    const fresh = await daily("Stale all");
    await editSeriesOccurrence(
      userId,
      fresh.id,
      at10(DAYS[0]),
      "all",
      { title: "Stale all (first)" },
      fresh.revision,
      { db: env!.db },
    );
    await expect(
      editSeriesOccurrence(
        userId,
        fresh.id,
        at10(DAYS[0]),
        "all",
        { title: "Stale all (lost)" },
        fresh.revision,
        { db: env!.db },
      ),
    ).rejects.toThrow("revision mismatch");
    expect(await titlesOn(DAYS[1])).toContain("Stale all (first)");
    expect(await titlesOn(DAYS[1])).not.toContain("Stale all (lost)");
  });
});
