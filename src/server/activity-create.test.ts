import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  createEphemeralDb,
  insertUser,
  rethrowIfMigrationFailure,
  type EphemeralDb,
} from "./db/test-db";
import * as schema from "./db/schema";
import { createActivitySeries, NotFoundError } from "./dal";

let env: EphemeralDb | null = null;
let dbAvailable = false;

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
  } catch (error) {
    rethrowIfMigrationFailure(error);
    dbAvailable = false;
  }
}, 60_000);

afterAll(async () => {
  if (env) await env.teardown();
}, 60_000);

const itDb = (name: string, run: () => Promise<void>) =>
  it(name, async ({ skip }) => {
    if (!dbAvailable || !env) {
      skip(true, "Postgres unavailable");
      return;
    }
    await run();
  });

async function addUser(label: string) {
  const id = crypto.randomUUID();
  await insertUser(env!.db, id, `${label}-${id}@test.com`);
  return id;
}

describe("canonical activity creation", () => {
  itDb("persists every canonical activity field", async () => {
    const userId = await addUser("canonical-create");
    const categoryId = crypto.randomUUID();
    const tagId = crypto.randomUUID();
    await env!.db.insert(schema.categories).values({
      id: categoryId,
      userId,
      key: "canonical-work",
      label: "Work",
    });
    await env!.db.insert(schema.tags).values({
      id: tagId,
      userId,
      name: "Canonical",
    });
    const exdate = [new Date("2026-08-03T00:00:00.000Z")];
    const rdate = [new Date("2026-08-04T14:00:00.000Z")];

    const series = await createActivitySeries(
      userId,
      {
        tz: "America/New_York",
        dtstartLocal: new Date("2026-08-02T14:00:00.000Z"),
        rrule: "FREQ=DAILY",
        exdate,
        rdate,
        title: "Canonical create",
        emoji: "🧭",
        categoryId,
        durationMin: 25,
        checklistTemplate: [{ label: "Step one", done: true }],
        energy: "high",
        priority: "high",
        tags: [tagId],
        notes: "Preserve every field",
        source: "calendar",
        sourceRef: "round54-contract",
      },
      { db: env!.db },
    );

    expect(series).toMatchObject({
      exdate,
      rdate,
      tz: "America/New_York",
      dtstartLocal: new Date("2026-08-02T14:00:00.000Z"),
      rrule: "FREQ=DAILY",
      title: "Canonical create",
      emoji: "🧭",
      categoryId,
      durationMin: 25,
      checklistTemplate: [{ label: "Step one", done: true }],
      energy: "high",
      priority: "high",
      tags: [tagId],
      notes: "Preserve every field",
      source: "calendar",
      sourceRef: "round54-contract",
    });
  });

  itDb("atomically rejects category and tag ids outside the owner", async () => {
    const userId = await addUser("canonical-owner");
    const otherUserId = await addUser("canonical-other");
    const categoryId = crypto.randomUUID();
    const tagId = crypto.randomUUID();
    await env!.db.insert(schema.categories).values({
      id: categoryId,
      userId: otherUserId,
      key: "other-category",
      label: "Other",
    });
    await env!.db.insert(schema.tags).values({
      id: tagId,
      userId: otherUserId,
      name: "Other tag",
    });

    for (const nestedInput of [{ categoryId }, { tags: [tagId] }]) {
      const beforeSeries = await env!.db
        .select({ id: schema.activitySeries.id })
        .from(schema.activitySeries)
        .where(eq(schema.activitySeries.userId, userId));
      const beforeChanges = await env!.db
        .select({ id: schema.changeLog.id })
        .from(schema.changeLog)
        .where(
          and(
            eq(schema.changeLog.userId, userId),
            eq(schema.changeLog.entityType, "activity_series"),
          ),
        );

      await expect(
        createActivitySeries(
          userId,
          {
            tz: "UTC",
            dtstartLocal: new Date("2026-08-02T14:00:00.000Z"),
            title: "Reject cross-owner reference",
            durationMin: 25,
            ...nestedInput,
          },
          { db: env!.db },
        ),
      ).rejects.toBeInstanceOf(NotFoundError);

      const afterSeries = await env!.db
        .select({ id: schema.activitySeries.id })
        .from(schema.activitySeries)
        .where(eq(schema.activitySeries.userId, userId));
      const afterChanges = await env!.db
        .select({ id: schema.changeLog.id })
        .from(schema.changeLog)
        .where(
          and(
            eq(schema.changeLog.userId, userId),
            eq(schema.changeLog.entityType, "activity_series"),
          ),
        );
      expect(afterSeries).toHaveLength(beforeSeries.length);
      expect(afterChanges).toHaveLength(beforeChanges.length);
    }
  });
});
