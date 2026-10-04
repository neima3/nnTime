/**
 * Synthetic planner fixture for local backup/restore rehearsal — no production data.
 */
import { eq, sql } from "drizzle-orm";
import type { EphemeralDb } from "./test-db";
import { insertUser } from "./test-db";
import {
  createActivitySeries,
  createTask,
  getChanges,
  scheduleTask,
  updateTask,
  upsertOccurrence,
  type Db,
} from "../dal";
import * as schema from "./schema";

export interface SyntheticPlannerFingerprint {
  userId: string;
  taskId: string;
  taskTitle: string;
  seriesId: string;
  occurrenceTitle: string;
  changeLogTailEntityId: string;
  plannerEventCount: number;
}

export async function seedSyntheticPlanner(
  env: EphemeralDb,
): Promise<SyntheticPlannerFingerprint> {
  const userId = crypto.randomUUID();
  await insertUser(env.db, userId, `rehearsal-${userId}@synthetic.local`);

  const db: Db = env.db;
  const task = await createTask(
    userId,
    { bucket: "inbox", title: "Rehearsal capture", priority: "high" },
    { db },
  );
  const updated = await updateTask(
    userId,
    task.id,
    { title: "Rehearsal capture (edited)" },
    task.revision,
    { db },
  );

  const series = await scheduleTask(
    userId,
    updated.id,
    {
      tz: "America/New_York",
      dtstartLocal: new Date("2026-09-01T14:00:00.000Z"),
      rrule: "FREQ=DAILY;COUNT=3",
      title: "Rehearsal daily block",
      durationMin: 30,
      source: "manual",
    },
    { db },
  );

  const occKey = new Date("2026-09-01T14:00:00.000Z");
  const occ = await upsertOccurrence(userId, series.id, occKey, {
    title: "Rehearsal override title",
    status: "completed",
  }, { db });

  const standalone = await createActivitySeries(
    userId,
    {
      tz: "UTC",
      dtstartLocal: new Date("2026-09-02T09:00:00.000Z"),
      title: "Rehearsal standalone series",
      durationMin: 15,
      rrule: "FREQ=WEEKLY;BYDAY=TU",
    },
    { db },
  );

  await env.db.insert(schema.plannerEvents).values({
    id: crypto.randomUUID(),
    userId,
    entityType: "activity",
    entityId: standalone.id,
    eventType: "mood_checkin",
    payload: { rehearsal: true, label: "synthetic-history" },
    occurredAt: new Date("2026-09-02T09:00:00.000Z"),
    tz: "UTC",
  });

  const { items: changes } = await getChanges(userId, 0, 50, { db });
  expectChangesPresent(changes as { entityId: string }[]);

  const plannerEvents = await env.db
    .select()
    .from(schema.plannerEvents)
    .where(eq(schema.plannerEvents.userId, userId));

  return {
    userId,
    taskId: task.id,
    taskTitle: updated.title,
    seriesId: series.id,
    occurrenceTitle: String(occ.title ?? "Rehearsal override title"),
    changeLogTailEntityId: String((changes.at(-1) as { entityId: string } | undefined)?.entityId ?? task.id),
    plannerEventCount: plannerEvents.length,
  };
}

function expectChangesPresent(
  changes: { entityId: string }[],
): void {
  if (changes.length < 2) {
    throw new Error(`expected change_log rows from task + schedule, got ${changes.length}`);
  }
}

export async function verifySyntheticPlannerIntegrity(
  db: Db,
  fp: SyntheticPlannerFingerprint,
): Promise<void> {
  const [task] = await db
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.id, fp.taskId));
  if (!task || task.title !== fp.taskTitle) {
    throw new Error("task row missing or title mismatch after restore");
  }
  if (task.convertedTo !== fp.seriesId) {
    throw new Error("task→series conversion link broken after restore");
  }

  const occs = await db
    .select()
    .from(schema.activityOccurrences)
    .where(eq(schema.activityOccurrences.seriesId, fp.seriesId));
  if (occs.length !== 1 || occs[0]?.title !== fp.occurrenceTitle) {
    throw new Error("occurrence override missing after restore");
  }

  const { items: changes } = await getChanges(fp.userId, 0, 50, { db });
  if (changes.length < 2) {
    throw new Error("change_log feed incomplete after restore");
  }
  if (!changes.some((c) => String(c.entityId) === fp.changeLogTailEntityId)) {
    throw new Error("expected change_log entity missing after restore");
  }

  const events = await db.execute<{ n: string }>(
    sql`SELECT count(*)::text AS n FROM planner_events WHERE user_id = ${fp.userId}`,
  );
  const count = Number((events as { n: string }[])[0]?.n ?? "0");
  if (count < fp.plannerEventCount) {
    throw new Error(`planner_events count ${count} < expected ${fp.plannerEventCount}`);
  }

  const seriesRows = await db
    .select()
    .from(schema.activitySeries)
    .where(eq(schema.activitySeries.userId, fp.userId));
  if (seriesRows.length < 2) {
    throw new Error("expected scheduled + standalone activity series after restore");
  }
  const withRrule = seriesRows.filter((s) => s.rrule && s.rrule.length > 0);
  if (withRrule.length < 2) {
    throw new Error("recurrence rrule not preserved after restore");
  }
}
