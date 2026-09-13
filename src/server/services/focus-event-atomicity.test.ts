/**
 * Focus-start planner-event atomicity (ADR-001 history + ADR-002 idempotency).
 *
 * The POST /api/v1/focus-sessions handler used to swallow appendPlannerEvent
 * failures with `.catch(() => {})` after startFocusSession had already written
 * (or yielded) a session. A retry then replayed the stored 201 and the
 * focus_start row never appeared.
 *
 * Binding: session insert + focus_start event share the same transaction as
 * withIdempotency. If the event write fails, the new session and any yield of
 * the prior active session must roll back.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  createEphemeralDb,
  insertUser,
  rethrowIfMigrationFailure,
  type EphemeralDb,
} from "../db/test-db";
import * as schema from "../db/schema";
import { appendPlannerEvent, type Db } from "../dal";
import { getActiveSession, startFocusSession } from "./focus";

let env: EphemeralDb | null = null;
let dbAvailable = false;
let userId: string;

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
    userId = crypto.randomUUID();
    await insertUser(env.db, userId, "focus-event@test.com");
  } catch (e) {
    rethrowIfMigrationFailure(e);
    dbAvailable = false;
  }
}, 60000);

afterAll(async () => {
  if (env) await env.teardown();
}, 60000);

const itDb = (name: string, fn: () => Promise<void> | void) =>
  it(name, async ({ skip }) => {
    if (!dbAvailable || !env) {
      console.warn(`[SKIP] ${name}: Postgres unavailable`);
      skip(true, "Postgres unavailable");
      return;
    }
    await fn();
  });

describe("focus start + planner event atomicity", () => {
  itDb("rolls back a new session and preserves the prior one when the event write fails", async () => {
    const existing = await startFocusSession(
      userId,
      { targetDurationMin: 25 },
      { db: env!.db },
    );

    await expect(
      env!.db.transaction(async (tx) => {
        const tdb = tx as unknown as Db;
        const session = await startFocusSession(
          userId,
          { targetDurationMin: 10 },
          { db: tdb },
        );
        await appendPlannerEvent(
          userId,
          {
            entityType: "focus_session",
            entityId: session.id,
            eventType: "focus_start",
            payload: { targetDurationMin: 10 },
          },
          { db: tdb },
        );
        throw new Error("planner event write failed");
      }),
    ).rejects.toThrow("planner event write failed");

    const active = await getActiveSession(userId, { db: env!.db });
    expect(active?.id).toBe(existing.id);
    expect(active?.state).toBe("running");
    expect(active?.targetDurationMin).toBe(25);

    const starts = await env!.db
      .select()
      .from(schema.plannerEvents)
      .where(
        and(
          eq(schema.plannerEvents.userId, userId),
          eq(schema.plannerEvents.eventType, "focus_start"),
        ),
      );
    expect(starts).toHaveLength(0);
  });

  itDb("commits the session and exactly one focus_start when the event write succeeds", async () => {
    const isolated = crypto.randomUUID();
    await insertUser(env!.db, isolated, `focus-ok-${isolated}@test.com`);

    const session = await env!.db.transaction(async (tx) => {
      const tdb = tx as unknown as Db;
      const started = await startFocusSession(
        isolated,
        { targetDurationMin: 25 },
        { db: tdb },
      );
      await appendPlannerEvent(
        isolated,
        {
          entityType: "focus_session",
          entityId: started.id,
          eventType: "focus_start",
          payload: { targetDurationMin: 25 },
        },
        { db: tdb },
      );
      return started;
    });

    const active = await getActiveSession(isolated, { db: env!.db });
    expect(active?.id).toBe(session.id);
    const starts = await env!.db
      .select()
      .from(schema.plannerEvents)
      .where(
        and(
          eq(schema.plannerEvents.userId, isolated),
          eq(schema.plannerEvents.eventType, "focus_start"),
        ),
      );
    expect(starts).toHaveLength(1);
    expect(starts[0]?.entityId).toBe(session.id);
  });
});
