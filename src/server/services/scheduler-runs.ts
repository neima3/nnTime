import "server-only";
import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  lt,
  or,
} from "drizzle-orm";
import type { Db } from "../dal";
import * as schema from "../db/schema";

function sanitizeSchedulerError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/https?:\/\/\S+/gi, "[redacted]")
    .replace(
      /\b(authorization)\b\s*[:=]\s*(?:bearer\s+)?[^\s,;]+/gi,
      "$1=[redacted]",
    )
    .replace(/\bbearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(
      /\b(api[_-]?key|token|secret|password|passwd)\b\s*[:=]\s*[^\s,;]+/gi,
      "$1=[redacted]",
    )
    .replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      "[redacted-email]",
    )
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
      or(
        and(
          inArray(schema.schedulerRuns.state, ["succeeded", "failed"]),
          lt(schema.schedulerRuns.finishedAt, cutoff),
        ),
        and(
          eq(schema.schedulerRuns.state, "running"),
          lt(schema.schedulerRuns.startedAt, cutoff),
        ),
      ),
    )
    .returning({ id: schema.schedulerRuns.id });
  return removed.length;
}

export type SchedulerHealth =
  | { state: "unconfigured"; lagSeconds: null }
  | { state: "warming"; lagSeconds: null }
  | { state: "ok"; lagSeconds: number }
  | { state: "lagging"; lagSeconds: number | null }
  | { state: "failed"; lagSeconds: number | null };

export async function getSchedulerHealth(input: {
  db: Db;
  now: Date;
  configured: boolean;
  processStartedAt: Date;
  maxLagMs?: number;
}): Promise<SchedulerHealth> {
  if (!input.configured) {
    return { state: "unconfigured", lagSeconds: null };
  }

  const maxLagMs = input.maxLagMs ?? 5 * 60_000;
  const [completedRows, successRows] = await Promise.all([
    input.db
      .select()
      .from(schema.schedulerRuns)
      .where(isNotNull(schema.schedulerRuns.finishedAt))
      .orderBy(desc(schema.schedulerRuns.finishedAt))
      .limit(1),
    input.db
      .select()
      .from(schema.schedulerRuns)
      .where(eq(schema.schedulerRuns.state, "succeeded"))
      .orderBy(desc(schema.schedulerRuns.finishedAt))
      .limit(1),
  ]);
  const latestCompleted = completedRows[0];
  const latestSuccess = successRows[0];

  if (!latestCompleted) {
    if (input.now.getTime() - input.processStartedAt.getTime() <= maxLagMs) {
      return { state: "warming", lagSeconds: null };
    }
    return { state: "lagging", lagSeconds: null };
  }

  const lagSeconds = latestSuccess?.finishedAt
    ? Math.max(
        0,
        Math.floor(
          (input.now.getTime() - latestSuccess.finishedAt.getTime()) / 1_000,
        ),
      )
    : null;
  if (
    latestCompleted.state === "failed" &&
    (!latestSuccess?.finishedAt ||
      latestCompleted.finishedAt!.getTime() >
        latestSuccess.finishedAt.getTime())
  ) {
    return { state: "failed", lagSeconds };
  }
  if (lagSeconds === null || lagSeconds * 1_000 > maxLagMs) {
    return { state: "lagging", lagSeconds };
  }
  return { state: "ok", lagSeconds };
}
