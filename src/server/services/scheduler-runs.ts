import "server-only";
import { and, inArray, lt } from "drizzle-orm";
import type { Db } from "../dal";
import * as schema from "../db/schema";

function sanitizeSchedulerError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/https?:\/\/\S+/gi, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

export async function startSchedulerRun(
  db: Db,
  now: Date,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(schema.schedulerRuns).values({
    id,
    state: "running",
    startedAt: now,
  });
  return id;
}

export async function succeedSchedulerRun(
  db: Db,
  id: string,
  now: Date,
  summary: Record<string, unknown>,
): Promise<void> {
  await db
    .update(schema.schedulerRuns)
    .set({
      state: "succeeded",
      finishedAt: now,
      summary,
      lastError: null,
    })
    .where(inArray(schema.schedulerRuns.id, [id]));
}

export async function failSchedulerRun(
  db: Db,
  id: string,
  now: Date,
  error: unknown,
): Promise<void> {
  await db
    .update(schema.schedulerRuns)
    .set({
      state: "failed",
      finishedAt: now,
      summary: {},
      lastError: sanitizeSchedulerError(error),
    })
    .where(inArray(schema.schedulerRuns.id, [id]));
}

export async function pruneSchedulerRuns(
  db: Db,
  now: Date,
  retentionDays = 30,
): Promise<number> {
  const cutoff = new Date(
    now.getTime() - Math.max(1, retentionDays) * 24 * 60 * 60_000,
  );
  const removed = await db
    .delete(schema.schedulerRuns)
    .where(
      and(
        inArray(schema.schedulerRuns.state, ["succeeded", "failed"]),
        lt(schema.schedulerRuns.finishedAt, cutoff),
      ),
    )
    .returning({ id: schema.schedulerRuns.id });
  return removed.length;
}
