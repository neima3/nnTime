import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, asc, eq } from "drizzle-orm";
import {
  createEphemeralDb,
  insertUser,
  rethrowIfMigrationFailure,
  type EphemeralDb,
} from "../db/test-db";
import * as schema from "../db/schema";
import { createTask, NotFoundError, scheduleTask } from "./index";
import { withIdempotency } from "../idempotency";

let env: EphemeralDb | null = null;
let dbAvailable = false;
let userId = "task-schedule-user";
let otherUserId = "task-schedule-other";

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
    userId = crypto.randomUUID();
    otherUserId = crypto.randomUUID();
    await insertUser(env.db, userId, "task-schedule@test.com");
    await insertUser(env.db, otherUserId, "task-schedule-other@test.com");
  } catch (error) {
    rethrowIfMigrationFailure(error);
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

const scheduleInput = {
  tz: "America/New_York",
  dtstartLocal: new Date("2026-08-02T14:00:00.000Z"),
  rrule: null,
  title: "Call the pharmacy",
  emoji: "☎️",
  durationMin: 25,
  energy: "low" as const,
  priority: "high" as const,
  notes: "Ask about the refill",
  source: "manual" as const,
  checklistTemplate: [
    { label: "Find the prescription number", done: true },
    { label: "Write down the answer", done: false },
  ],
};

describe("scheduleTask atomic conversion", () => {
  itDb("creates one series and transfers task identity, checklist, sync, and history", async () => {
    const task = await createTask(
      userId,
      {
        bucket: "inbox",
        title: "Call the pharmacy",
        emoji: "☎️",
        priority: "high",
        energy: "low",
        notes: "Ask about the refill",
      },
      { db: env!.db },
    );
    await env!.db.insert(schema.checklistItems).values([
      {
        id: crypto.randomUUID(),
        userId,
        parentType: "task",
        parentId: task.id,
        label: "Find the prescription number",
        sortOrder: 0,
      },
      {
        id: crypto.randomUUID(),
        userId,
        parentType: "task",
        parentId: task.id,
        label: "Have insurance card ready",
        sortOrder: 1,
      },
    ]);

    const series = await scheduleTask(userId, task.id, scheduleInput, {
      db: env!.db,
    });

    expect(series).toMatchObject({
      title: "Call the pharmacy",
      emoji: "☎️",
      durationMin: 25,
      priority: "high",
      energy: "low",
      notes: "Ask about the refill",
    });
    expect(series.checklistTemplate).toEqual([
      { label: "Find the prescription number", done: true },
      { label: "Write down the answer", done: false },
    ]);

    const [source] = await env!.db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, task.id));
    expect(source).toMatchObject({ convertedTo: series.id, revision: 2 });
    expect(source?.deletedAt).toBeInstanceOf(Date);

    const checklist = await env!.db
      .select()
      .from(schema.checklistItems)
      .where(eq(schema.checklistItems.userId, userId))
      .orderBy(asc(schema.checklistItems.sortOrder));
    expect(checklist[0]).toMatchObject({
      label: "Find the prescription number",
      parentType: "series",
      parentId: series.id,
      done: true,
      deletedAt: null,
    });
    expect(checklist[1]).toMatchObject({
      label: "Have insurance card ready",
      parentType: "task",
      parentId: task.id,
    });
    expect(checklist[1]?.deletedAt).toBeInstanceOf(Date);

    const changes = await env!.db
      .select()
      .from(schema.changeLog)
      .where(eq(schema.changeLog.userId, userId));
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: "activity_series",
          entityId: series.id,
          op: "upsert",
        }),
        expect.objectContaining({
          entityType: "tasks",
          entityId: task.id,
          op: "delete",
          revision: 2,
        }),
      ]),
    );
    const checklistChanges = changes.filter(
      (entry) => entry.entityType === "checklist_items",
    );
    expect(checklistChanges.map((entry) => entry.op).sort()).toEqual([
      "delete",
      "upsert",
    ]);

    const [event] = await env!.db
      .select()
      .from(schema.plannerEvents)
      .where(
        and(
          eq(schema.plannerEvents.userId, userId),
          eq(schema.plannerEvents.entityId, task.id),
          eq(schema.plannerEvents.eventType, "reschedule"),
        ),
      );
    expect(event?.payload).toEqual({
      sourceTaskId: task.id,
      targetSeriesId: series.id,
    });

    await expect(
      scheduleTask(userId, task.id, scheduleInput, { db: env!.db }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const seriesRows = await env!.db
      .select()
      .from(schema.activitySeries)
      .where(eq(schema.activitySeries.userId, userId));
    expect(seriesRows.filter((row) => row.id === series.id)).toHaveLength(1);
  });

  itDb("transfers the source checklist when the request leaves it implicit", async () => {
    const task = await createTask(
      userId,
      { bucket: "inbox", title: "Implicit checklist" },
      { db: env!.db },
    );
    await env!.db.insert(schema.checklistItems).values({
      id: crypto.randomUUID(),
      userId,
      parentType: "task",
      parentId: task.id,
      label: "Keep this step",
      done: true,
    });

    const series = await scheduleTask(
      userId,
      task.id,
      { ...scheduleInput, title: task.title, checklistTemplate: undefined },
      { db: env!.db },
    );

    expect(series.checklistTemplate).toEqual([
      { label: "Keep this step", done: true },
    ]);
    const [item] = await env!.db
      .select()
      .from(schema.checklistItems)
      .where(eq(schema.checklistItems.parentId, series.id));
    expect(item).toMatchObject({
      parentType: "series",
      label: "Keep this step",
      done: true,
      deletedAt: null,
    });
  });

  itDb("treats an explicit empty checklist as authoritative", async () => {
    const task = await createTask(
      userId,
      { bucket: "inbox", title: "Remove every step" },
      { db: env!.db },
    );
    await env!.db.insert(schema.checklistItems).values({
      id: crypto.randomUUID(),
      userId,
      parentType: "task",
      parentId: task.id,
      label: "Remove me",
      done: true,
    });

    const series = await scheduleTask(
      userId,
      task.id,
      { ...scheduleInput, title: task.title, checklistTemplate: [] },
      { db: env!.db },
    );

    expect(series.checklistTemplate).toEqual([]);
    const [item] = await env!.db
      .select()
      .from(schema.checklistItems)
      .where(eq(schema.checklistItems.parentId, task.id));
    expect(item?.deletedAt).toBeInstanceOf(Date);
  });

  itDb("keeps duplicate checklist labels distinct and ordered", async () => {
    const task = await createTask(
      userId,
      { bucket: "inbox", title: "Duplicate steps" },
      { db: env!.db },
    );
    await env!.db.insert(schema.checklistItems).values([
      {
        id: crypto.randomUUID(),
        userId,
        parentType: "task",
        parentId: task.id,
        label: "Check it",
        sortOrder: 0,
      },
      {
        id: crypto.randomUUID(),
        userId,
        parentType: "task",
        parentId: task.id,
        label: "check IT",
        sortOrder: 1,
      },
    ]);

    const series = await scheduleTask(
      userId,
      task.id,
      {
        ...scheduleInput,
        title: task.title,
        checklistTemplate: [
          { label: "Check it", done: true },
          { label: "check IT", done: false },
        ],
      },
      { db: env!.db },
    );
    const rows = await env!.db
      .select()
      .from(schema.checklistItems)
      .where(eq(schema.checklistItems.parentId, series.id))
      .orderBy(asc(schema.checklistItems.sortOrder));
    expect(rows.map((row) => ({ sortOrder: row.sortOrder, done: row.done }))).toEqual([
      { sortOrder: 0, done: true },
      { sortOrder: 1, done: false },
    ]);
  });

  itDb("persists every canonical activity field and allows inherited metadata to be cleared", async () => {
    const categoryId = crypto.randomUUID();
    const tagId = crypto.randomUUID();
    await env!.db.insert(schema.categories).values({
      id: categoryId,
      userId,
      key: `round53-${categoryId}`,
      label: "Round 53",
    });
    await env!.db.insert(schema.tags).values({
      id: tagId,
      userId,
      name: `round53-${tagId}`,
    });
    const task = await createTask(
      userId,
      {
        bucket: "inbox",
        title: "Canonical fields",
        energy: "high",
        notes: "Clear this",
      },
      { db: env!.db },
    );
    const exdate = [new Date("2026-08-03T00:00:00.000Z")];
    const rdate = [new Date("2026-08-04T14:00:00.000Z")];

    const series = await scheduleTask(
      userId,
      task.id,
      {
        ...scheduleInput,
        exdate,
        rdate,
        categoryId,
        tags: [tagId],
        sourceRef: "inbox-conversion",
        energy: null,
        notes: "",
      },
      { db: env!.db },
    );

    expect(series).toMatchObject({
      exdate,
      rdate,
      categoryId,
      tags: [tagId],
      sourceRef: "inbox-conversion",
      energy: null,
      notes: "",
    });
  });

  itDb("rejects category and tag ids outside the authenticated owner", async () => {
    const categoryId = crypto.randomUUID();
    const tagId = crypto.randomUUID();
    await env!.db.insert(schema.categories).values({
      id: categoryId,
      userId: otherUserId,
      key: `other-${categoryId}`,
      label: "Other category",
    });
    await env!.db.insert(schema.tags).values({
      id: tagId,
      userId: otherUserId,
      name: `other-${tagId}`,
    });

    for (const nestedInput of [{ categoryId }, { tags: [tagId] }]) {
      const task = await createTask(
        userId,
        { bucket: "inbox", title: "Owner-scoped nested id" },
        { db: env!.db },
      );
      await expect(
        scheduleTask(
          userId,
          task.id,
          { ...scheduleInput, ...nestedInput },
          { db: env!.db },
        ),
      ).rejects.toBeInstanceOf(NotFoundError);
      const [source] = await env!.db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, task.id));
      expect(source).toMatchObject({ deletedAt: null, convertedTo: null });
    }
  });

  itDb("serializes same-key retries and stores one conversion response", async () => {
    const before = await env!.db
      .select()
      .from(schema.activitySeries)
      .where(eq(schema.activitySeries.userId, userId));
    const task = await createTask(
      userId,
      { bucket: "inbox", title: "Concurrent idempotency" },
      { db: env!.db },
    );
    const key = crypto.randomUUID();
    const execute = () =>
      withIdempotency(
        userId,
        key,
        "POST",
        `/api/v1/tasks/${task.id}/schedule`,
        async (lockedDb) => {
          const series = await scheduleTask(userId, task.id, scheduleInput, {
            db: lockedDb,
          });
          return Response.json(series, { status: 201 });
        },
        { db: env!.db },
      );

    const [first, second] = await Promise.all([execute(), execute()]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(await first.json()).toEqual(await second.json());
    expect(
      [first, second].filter(
        (response) => response.headers.get("idempotent-replay") === "true",
      ),
    ).toHaveLength(1);
    const rows = await env!.db
      .select()
      .from(schema.activitySeries)
      .where(eq(schema.activitySeries.userId, userId));
    expect(rows).toHaveLength(before.length + 1);
  });

  itDb("returns not-found across owners without creating an activity", async () => {
    const task = await createTask(
      userId,
      { bucket: "inbox", title: "Owner only" },
      { db: env!.db },
    );
    const before = await env!.db
      .select()
      .from(schema.activitySeries)
      .where(eq(schema.activitySeries.userId, otherUserId));

    await expect(
      scheduleTask(otherUserId, task.id, scheduleInput, { db: env!.db }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const after = await env!.db
      .select()
      .from(schema.activitySeries)
      .where(eq(schema.activitySeries.userId, otherUserId));
    expect(after).toEqual(before);
  });

  itDb("rolls the source claim back when series creation fails", async () => {
    const task = await createTask(
      userId,
      { bucket: "inbox", title: "Stay put" },
      { db: env!.db },
    );

    await expect(
      scheduleTask(
        userId,
        task.id,
        { ...scheduleInput, title: null as unknown as string },
        { db: env!.db },
      ),
    ).rejects.toThrow();

    const [source] = await env!.db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, task.id));
    expect(source).toMatchObject({
      deletedAt: null,
      convertedTo: null,
      revision: 1,
    });
  });
});
