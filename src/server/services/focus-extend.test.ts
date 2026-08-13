/**
 * Focus session extend + transition tests — ADR-004.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEphemeralDb, rethrowIfMigrationFailure, insertUser, type EphemeralDb } from "../db/test-db";
import {
  startFocusSession, transitionFocusSession, extendFocusSession,
  getActiveSession,
} from "./focus";

let env: EphemeralDb | null = null;
let dbAvailable = false;
let userId: string;

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
    userId = crypto.randomUUID();
    await insertUser(env.db, userId, "focus-ext@test.com");
  } catch (e) {
    rethrowIfMigrationFailure(e);
    dbAvailable = false;
  }
}, 60000);

afterAll(async () => { if (env) await env.teardown(); });

const itDb = (name: string, fn: () => Promise<void> | void) =>
  it(name, async ({ skip }) => {
    if (!dbAvailable || !env) {
      console.warn(`[SKIP] ${name}: Postgres unavailable`);
      skip(true, "Postgres unavailable");
      return;
    }
    await fn();
  });

describe("Focus extend + multi-extend", () => {
  itDb("extend rejects a stale client revision and accepts the current one", async () => {
    const session = await startFocusSession(
      userId,
      { targetDurationMin: 25 },
      { db: env!.db },
    );

    await expect(
      extendFocusSession(
        userId,
        session.id,
        5,
        session.revision - 1,
        { db: env!.db },
      ),
    ).rejects.toMatchObject({
      message: "revision mismatch",
      serverState: expect.objectContaining({
        id: session.id,
        revision: session.revision,
      }),
    });

    const extended = await extendFocusSession(
      userId,
      session.id,
      5,
      session.revision,
      { db: env!.db },
    );
    expect(extended.targetDurationMin).toBe(30);
    expect(extended.revision).toBe(session.revision + 1);
  });

  itDb("multiple extends accumulate correctly", async () => {
    const s = await startFocusSession(userId, { targetDurationMin: 25 }, { db: env!.db });
    
    const e1 = await extendFocusSession(
      userId,
      s.id,
      5,
      s.revision,
      { db: env!.db },
    );
    expect(e1.targetDurationMin).toBe(30);
    
    const e2 = await extendFocusSession(
      userId,
      s.id,
      10,
      e1.revision,
      { db: env!.db },
    );
    expect(e2.targetDurationMin).toBe(40);
    
    const e3 = await extendFocusSession(
      userId,
      s.id,
      1,
      e2.revision,
      { db: env!.db },
    );
    expect(e3.targetDurationMin).toBe(41);
  });

  itDb("cannot extend a completed session", async () => {
    const s = await startFocusSession(userId, { targetDurationMin: 10 }, { db: env!.db });
    const completed = await transitionFocusSession(
      userId,
      s.id,
      "completed",
      s.revision,
      { db: env!.db },
    );
    
    await expect(
      extendFocusSession(
        userId,
        s.id,
        5,
        completed.revision,
        { db: env!.db },
      ),
    ).rejects.toThrow("can only extend");
  });

  itDb("new session supersedes old active one", async () => {
    const s1 = await startFocusSession(userId, { targetDurationMin: 25 }, { db: env!.db });
    const s2 = await startFocusSession(userId, { targetDurationMin: 15 }, { db: env!.db });
    
    const active = await getActiveSession(userId, { db: env!.db });
    expect(active?.id).toBe(s2.id);
    expect(active?.id).not.toBe(s1.id);
  });
});
