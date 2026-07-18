/**
 * Focus-session state machine tests — ADR-004 (Phase 3A).
 *
 * Verifies:
 *  - Starting a session auto-cancels any prior active session (two-device).
 *  - Only one active session per user (DB partial unique index).
 *  - Legal transitions: running→paused→running→completed.
 *  - Illegal transitions rejected.
 *  - Quick-extend adds minutes.
 *  - Remaining-time derivation is correct.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEphemeralDb, insertUser, type EphemeralDb } from "../db/test-db";
import {
  startFocusSession,
  transitionFocusSession,
  extendFocusSession,
  getRemainingSec,
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
    await insertUser(env!.db, userId, "focus@test.com");
  } catch {
    dbAvailable = false;
  }
}, 60000);

afterAll(async () => {
  if (env) await env.teardown();
}, 60000);

/** Skip (not pass) when Postgres is unavailable — honest CI signal. */
const itDb = (name: string, fn: () => Promise<void> | void) =>
  it(name, async ({ skip }) => {
    if (!dbAvailable || !env) {
      console.warn(`[SKIP] ${name}: Postgres unavailable`);
      skip(true, "Postgres unavailable");
      return;
    }
    await fn();
  });

describe("ADR-004 focus state machine", () => {
  itDb("starts a running session", async () => {
    const session = await startFocusSession(userId, { targetDurationMin: 25 }, { db: env!.db });
    expect(session.state).toBe("running");
    expect(session.targetDurationMin).toBe(25);
  });

  itDb("starting a new session auto-cancels the prior active one", async () => {
    const first = await startFocusSession(userId, { targetDurationMin: 25 }, { db: env!.db });
    const second = await startFocusSession(userId, { targetDurationMin: 15 }, { db: env!.db });
    // Only one active session exists (the second).
    const active = await getActiveSession(userId, { db: env!.db });
    expect(active?.id).toBe(second.id);
    expect(active?.id).not.toBe(first.id);
  });

  itDb("running → paused → running → completed", async () => {
    const session = await startFocusSession(userId, { targetDurationMin: 10 }, { db: env!.db });
    const paused = await transitionFocusSession(userId, session.id, "paused", { db: env!.db });
    expect(paused.state).toBe("paused");
    const resumed = await transitionFocusSession(userId, session.id, "running", { db: env!.db });
    expect(resumed.state).toBe("running");
    const done = await transitionFocusSession(userId, session.id, "completed", { db: env!.db });
    expect(done.state).toBe("completed");
  });

  itDb("illegal transition (completed → running) rejected", async () => {
    const session = await startFocusSession(userId, { targetDurationMin: 5 }, { db: env!.db });
    await transitionFocusSession(userId, session.id, "completed", { db: env!.db });
    await expect(
      transitionFocusSession(userId, session.id, "running", { db: env!.db }),
    ).rejects.toThrow("illegal transition");
  });

  itDb("quick-extend adds minutes to target duration", async () => {
    const session = await startFocusSession(userId, { targetDurationMin: 25 }, { db: env!.db });
    const extended = await extendFocusSession(userId, session.id, 5, { db: env!.db });
    expect(extended.targetDurationMin).toBe(30);
    const extended2 = await extendFocusSession(userId, session.id, 10, { db: env!.db });
    expect(extended2.targetDurationMin).toBe(40);
  });

  itDb("getRemainingSec derives from server time, not a stored countdown", async () => {
    // A session that started and has a known target. Remaining is derived.
    const fakeSession = {
      state: "running" as const,
      startedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
      targetDurationMin: 25,
      accumulatedPauseSec: 0,
      currentIntervalStartedAt: new Date(Date.now() - 5 * 60 * 1000),
    };
    const remaining = getRemainingSec(fakeSession);
    // Should be ~20 min (25 - 5 elapsed).
    expect(remaining).toBeGreaterThan(19 * 60);
    expect(remaining).toBeLessThan(21 * 60);
  });

  itDb("pause does not inflate accumulatedPauseSec with running time", async () => {
    const session = await startFocusSession(userId, { targetDurationMin: 25 }, { db: env!.db });
    // Brief running interval, then pause — accumulated pause must stay ~0.
    await new Promise((r) => setTimeout(r, 50));
    const paused = await transitionFocusSession(userId, session.id, "paused", { db: env!.db });
    expect(paused.state).toBe("paused");
    expect(paused.accumulatedPauseSec).toBe(0);
    expect(paused.currentIntervalStartedAt).not.toBeNull();
  });
});

describe("getRemainingSec pure derivation", () => {
  const MIN = 60 * 1000;
  const t0 = Date.UTC(2026, 0, 1, 12, 0, 0);

  it("running session started 5 min ago, target 25 → remaining ~20 min", () => {
    const remaining = getRemainingSec(
      {
        state: "running",
        startedAt: new Date(t0),
        targetDurationMin: 25,
        accumulatedPauseSec: 0,
        currentIntervalStartedAt: new Date(t0),
      },
      t0 + 5 * MIN,
    );
    expect(remaining).toBe(20 * 60);
  });

  it("paused session freezes remaining and does not decay with later now", () => {
    // Started at t0; ran 3 min then paused (currentIntervalStartedAt = pause start).
    // Wall "now" is 10 min after start (7 min into the pause).
    // effectiveNow freezes at pause start → elapsed 3 min → remaining 22 min.
    const session = {
      state: "paused" as const,
      startedAt: new Date(t0),
      targetDurationMin: 25,
      accumulatedPauseSec: 0,
      currentIntervalStartedAt: new Date(t0 + 3 * MIN),
    };
    const remaining = getRemainingSec(session, t0 + 10 * MIN);
    expect(remaining).toBe(22 * 60);
    // Still frozen if we call again with a simulated later now.
    expect(getRemainingSec(session, t0 + 30 * MIN)).toBe(22 * 60);
  });

  it("after resume accounting: accumulatedPauseSec excluded from elapsed", () => {
    // 10 min wall since start; 2 min completed pause already in accumulatedPauseSec.
    // Effective focus elapsed = 10 - 2 = 8 min → remaining 17 min.
    const remaining = getRemainingSec(
      {
        state: "running",
        startedAt: new Date(t0),
        targetDurationMin: 25,
        accumulatedPauseSec: 2 * 60,
        currentIntervalStartedAt: new Date(t0 + 8 * MIN),
      },
      t0 + 10 * MIN,
    );
    expect(remaining).toBe(17 * 60);
  });
});

