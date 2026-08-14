/**
 * Tasks + checklist items (ADR-005 SEC-01).
 *
 * Every query scopes by the authenticated session's userId IN THE SAME
 * PREDICATE. See `./index.ts` for the DAL-wide contract.
 */
import "server-only";
import dbDefault from "../db";
import * as schema from "../db/schema";
import { and, eq, isNull, asc, sql } from "drizzle-orm";
import type { Db } from "./types";
import { ConflictError, NotFoundError } from "./errors";
import { appendChangeLog } from "./change-log";
import { assertOwnedActivityReferences } from "./tags-categories-settings";

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

export async function listTasks(
  userId: string,
  opts: { bucket?: "inbox" | "anytime"; db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  const conditions = [
    eq(schema.tasks.userId, userId),
    isNull(schema.tasks.deletedAt),
  ];
  if (opts.bucket) conditions.push(eq(schema.tasks.bucket, opts.bucket));
  return db
    .select()
    .from(schema.tasks)
    .where(and(...conditions))
    .orderBy(asc(schema.tasks.createdAt));
}

export async function getTask(userId: string, id: string, opts: { db?: Db } = {}) {
  const db = opts.db ?? dbDefault;
  const [task] = await db
    .select()
    .from(schema.tasks)
    .where(and(eq(schema.tasks.id, id), eq(schema.tasks.userId, userId)))
    .limit(1);
  if (!task || task.deletedAt) throw new NotFoundError("task");
  return task;
}

export async function createTask(
  userId: string,
  input: {
    bucket: "inbox" | "anytime";
    title: string;
    emoji?: string;
    categoryId?: string;
    date?: Date | null;
    priority?: "none" | "low" | "high";
    energy?: "low" | "medium" | "high" | null;
    notes?: string;
  },
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const id = crypto.randomUUID();
    const [task] = await tdb
      .insert(schema.tasks)
      .values({ id, userId, ...input })
      .returning();
    await appendChangeLog(tdb, userId, "tasks", id, "upsert", task!.revision);
    return task!;
  });
}

export async function updateTask(
  userId: string,
  id: string,
  input: Partial<{
    bucket: "inbox" | "anytime";
    title: string;
    emoji: string;
    categoryId: string;
    date: Date | null;
    priority: "none" | "low" | "high";
    energy: "low" | "medium" | "high";
    notes: string;
  }>,
  ifMatchRevision: number,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const [updated] = await tdb
      .update(schema.tasks)
      .set({ ...input, revision: ifMatchRevision + 1, updatedAt: new Date() })
      .where(
        and(
          eq(schema.tasks.id, id),
          eq(schema.tasks.userId, userId),
          eq(schema.tasks.revision, ifMatchRevision),
          isNull(schema.tasks.deletedAt),
        ),
      )
      .returning();
    if (!updated) {
      // Distinguish not-found vs conflict.
      try {
        const existing = await getTask(userId, id, { db: tdb });
        throw new ConflictError("revision mismatch", existing);
      } catch (e) {
        if (e instanceof ConflictError) throw e;
        if (e instanceof NotFoundError) throw e;
        throw e;
      }
    }
    await appendChangeLog(tdb, userId, "tasks", id, "upsert", updated.revision);
    return updated;
  });
}

export async function deleteTask(
  userId: string,
  id: string,
  ifMatchRevision: number,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const [updated] = await tdb
      .update(schema.tasks)
      .set({ deletedAt: new Date(), revision: ifMatchRevision + 1 })
      .where(
        and(
          eq(schema.tasks.id, id),
          eq(schema.tasks.userId, userId),
          eq(schema.tasks.revision, ifMatchRevision),
          isNull(schema.tasks.deletedAt),
        ),
      )
      .returning();
    if (!updated) {
      try {
        const existing = await getTask(userId, id, { db: tdb });
        throw new ConflictError("revision mismatch", existing);
      } catch (e) {
        if (e instanceof ConflictError) throw e;
        if (e instanceof NotFoundError) throw e;
        throw e;
      }
    }
    await appendChangeLog(tdb, userId, "tasks", id, "delete", updated.revision);
  });
}

export async function listChecklistItems(
  userId: string,
  parentType: "series" | "task" | "occurrence",
  parentId: string,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  return db
    .select()
    .from(schema.checklistItems)
    .where(
      and(
        eq(schema.checklistItems.userId, userId),
        eq(schema.checklistItems.parentType, parentType),
        eq(schema.checklistItems.parentId, parentId),
        isNull(schema.checklistItems.deletedAt),
      ),
    )
    .orderBy(asc(schema.checklistItems.sortOrder));
}

export async function scheduleTask(
  userId: string,
  taskId: string,
  input: {
    tz: string;
    dtstartLocal: Date;
    rrule?: string | null;
    exdate?: Date[];
    rdate?: Date[];
    title: string;
    emoji?: string;
    categoryId?: string;
    durationMin: number;
    energy?: "low" | "medium" | "high" | null;
    priority?: "none" | "low" | "high";
    tags?: string[];
    notes?: string;
    source?: "manual" | "routine" | "calendar";
    sourceRef?: string;
    checklistTemplate?: unknown[];
  },
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const seriesId = crypto.randomUUID();
    const now = new Date();
    await assertOwnedActivityReferences(
      tdb,
      userId,
      input.categoryId,
      input.tags,
    );
    const [task] = await tdb
      .update(schema.tasks)
      .set({
        convertedTo: seriesId,
        deletedAt: now,
        updatedAt: now,
        revision: sql`${schema.tasks.revision} + 1`,
      })
      .where(
        and(
          eq(schema.tasks.id, taskId),
          eq(schema.tasks.userId, userId),
          isNull(schema.tasks.deletedAt),
          isNull(schema.tasks.convertedTo),
        ),
      )
      .returning();
    if (!task) throw new NotFoundError("task");

    const taskChecklist = await listChecklistItems(userId, "task", taskId, {
      db: tdb,
    });
    const requestedChecklist = input.checklistTemplate;
    const checklistTemplate =
      requestedChecklist ??
      taskChecklist.map((item) => ({ label: item.label, done: item.done }));
    const finalChecklistByLabel = new Map<
      string,
      { index: number; done: boolean | undefined }[]
    >();
    checklistTemplate.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") return;
      const label = (entry as { label?: unknown }).label;
      const done = (entry as { done?: unknown }).done;
      if (typeof label !== "string") return;
      const key = label.trim().toLocaleLowerCase();
      const matches = finalChecklistByLabel.get(key) ?? [];
      matches.push({
        index,
        done: typeof done === "boolean" ? done : undefined,
      });
      finalChecklistByLabel.set(key, matches);
    });

    const [series] = await tdb
      .insert(schema.activitySeries)
      .values({
        id: seriesId,
        userId,
        tz: input.tz,
        dtstartLocal: input.dtstartLocal,
        rrule: input.rrule ?? null,
        exdate: input.exdate ?? null,
        rdate: input.rdate ?? null,
        title: input.title,
        emoji: input.emoji ?? null,
        categoryId: input.categoryId ?? null,
        durationMin: input.durationMin,
        checklistTemplate,
        energy: input.energy ?? null,
        priority: input.priority ?? "none",
        tags: input.tags ?? null,
        notes: input.notes ?? null,
        source: input.source ?? "manual",
        sourceRef: input.sourceRef ?? null,
      })
      .returning();

    for (const item of taskChecklist) {
      const finalItems = finalChecklistByLabel.get(
        item.label.trim().toLocaleLowerCase(),
      );
      const finalItem = finalItems?.shift();
      const [moved] = await tdb
        .update(schema.checklistItems)
        .set(
          finalItem
            ? {
                parentType: "series",
                parentId: seriesId,
                sortOrder: finalItem.index,
                done: finalItem.done ?? item.done,
                revision: item.revision + 1,
                updatedAt: now,
              }
            : {
                deletedAt: now,
                revision: item.revision + 1,
                updatedAt: now,
              },
        )
        .where(
          and(
            eq(schema.checklistItems.id, item.id),
            eq(schema.checklistItems.userId, userId),
            eq(schema.checklistItems.parentType, "task"),
            eq(schema.checklistItems.parentId, taskId),
            isNull(schema.checklistItems.deletedAt),
          ),
        )
        .returning();
      if (!moved) throw new NotFoundError("checklist_item");
      await appendChangeLog(
        tdb,
        userId,
        "checklist_items",
        moved.id,
        finalItem ? "upsert" : "delete",
        moved.revision,
      );
    }

    await appendChangeLog(
      tdb,
      userId,
      "activity_series",
      seriesId,
      "upsert",
      series!.revision,
    );
    await appendChangeLog(
      tdb,
      userId,
      "tasks",
      taskId,
      "delete",
      task.revision,
    );
    await tdb.insert(schema.plannerEvents).values({
      id: crypto.randomUUID(),
      userId,
      entityType: "task",
      entityId: taskId,
      eventType: "reschedule",
      payload: { sourceTaskId: taskId, targetSeriesId: seriesId },
      occurredAt: now,
      tz: input.tz,
    });
    return series!;
  });
}
