/**
 * Task 4.1 — mood check-in mutation family: unauthenticated and cross-user
 * boundaries at the HTTP handler (real requireSession + DAL), not mocked auth.
 *
 * Mood exposes only POST /api/v1/mood (no by-id mutation). Cross-user coverage
 * proves Mallory's authenticated POST appends only Mallory-owned planner_events
 * and leaves Alice's mood_checkin rows byte-for-byte unchanged.
 */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { and, count, eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import type { Db } from "@/server/dal";
import {
  createEphemeralDb,
  rethrowIfMigrationFailure,
  type EphemeralDb,
} from "@/server/db/test-db";
import { plannerEvents } from "@/server/db/schema";
import { recordMoodCheckin } from "@/server/services/stats";
import { signUpTestUser } from "@/server/test-api-route-auth";

vi.hoisted(() => {
  process.env.BETTER_AUTH_SECRET ??=
    "integration-test-secret-32chars-minimum";
  process.env.BETTER_AUTH_URL ??= "http://127.0.0.1:3000";
});

const dbHolder = vi.hoisted(() => ({ db: null as Db | null }));
const requestHeaders = vi.hoisted(() => ({
  current: new Headers() as Headers,
}));

vi.mock("@/server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db")>();
  return {
    ...actual,
    default: new Proxy({} as Db, {
      get(_target, prop, receiver) {
        const db = dbHolder.db;
        if (!db) {
          throw new Error("ephemeral db not initialized");
        }
        return Reflect.get(db, prop, receiver);
      },
    }),
  };
});

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => requestHeaders.current),
}));

vi.mock("@/server/db/migrate-on-startup", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/db/migrate-on-startup")>();
  return {
    ...actual,
    ensureMigrated: vi.fn(async () => undefined),
  };
});

import { auth } from "@/server/auth";
import { POST } from "./route";

const MOOD_BODY = { mood: "good" as const, note: "Integration boundary" };

let env: EphemeralDb | null = null;
let dbAvailable = false;

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbHolder.db = env.db as Db;
    dbAvailable = true;
  } catch (error) {
    rethrowIfMigrationFailure(error);
  }
}, 60_000);

afterAll(async () => {
  await env?.teardown();
  dbHolder.db = null;
}, 60_000);

beforeEach(() => {
  requestHeaders.current = new Headers();
});

const itDb = (name: string, fn: () => Promise<void>) =>
  it(name, async ({ skip }) => {
    if (!dbAvailable || !env) {
      console.warn(`[SKIP] ${name}: Postgres unavailable`);
      skip(true, "Postgres unavailable");
      return;
    }
    await fn();
  });

async function moodCheckinCount(): Promise<number> {
  const [row] = await env!.db
    .select({ n: count() })
    .from(plannerEvents)
    .where(eq(plannerEvents.eventType, "mood_checkin"));
  return Number(row?.n ?? 0);
}

async function moodRowsForUser(userId: string) {
  return env!.db
    .select()
    .from(plannerEvents)
    .where(
      and(
        eq(plannerEvents.userId, userId),
        eq(plannerEvents.eventType, "mood_checkin"),
      ),
    );
}

describe("POST /api/v1/mood integration (auth boundary)", () => {
  itDb("returns 401 and creates no mood_checkin when unauthenticated", async () => {
    const before = await moodCheckinCount();

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/v1/mood", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": uuidv7(),
        },
        body: JSON.stringify(MOOD_BODY),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "unauthorized" },
    });
    expect(await moodCheckinCount()).toBe(before);
  });
});

describe("POST /api/v1/mood integration (cross-user)", () => {
  itDb(
    "appends only Mallory's mood_checkin and leaves Alice's rows unchanged",
    async () => {
      const aliceEmail = `alice-${uuidv7()}@integration.test`;
      const malloryEmail = `mallory-${uuidv7()}@integration.test`;
      const password = "integration-test-password-12";

      const alice = await signUpTestUser(auth, {
        email: aliceEmail,
        password,
        name: "Alice",
      });
      const mallory = await signUpTestUser(auth, {
        email: malloryEmail,
        password,
        name: "Mallory",
      });
      expect(mallory.userId).not.toBe(alice.userId);

      await recordMoodCheckin(alice.userId, "good", "Alice baseline", {
        db: env!.db as Db,
      });
      const aliceBefore = await moodRowsForUser(alice.userId);
      expect(aliceBefore).toHaveLength(1);

      requestHeaders.current = new Headers({ cookie: mallory.cookieHeader });
      const response = await POST(
        new Request("http://127.0.0.1:3000/api/v1/mood", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": uuidv7(),
          },
          body: JSON.stringify({ mood: "low", note: "Mallory check-in" }),
        }),
      );

      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toEqual({ ok: true });

      const aliceAfter = await moodRowsForUser(alice.userId);
      expect(aliceAfter).toEqual(aliceBefore);

      const malloryRows = await moodRowsForUser(mallory.userId);
      expect(malloryRows).toHaveLength(1);
      expect(malloryRows[0]?.userId).toBe(mallory.userId);
      expect(malloryRows[0]?.payload).toMatchObject({
        mood: "low",
        note: "Mallory check-in",
        userId: mallory.userId,
      });
    },
  );
});
