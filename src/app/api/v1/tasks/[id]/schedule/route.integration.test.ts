/**
 * Task 4.1 — task schedule mutation family: unauthenticated and cross-user
 * boundaries at the HTTP handler (real requireSession + DAL), not mocked auth.
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
import { count, eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import type { Db } from "@/server/dal";
import {
  createEphemeralDb,
  rethrowIfMigrationFailure,
  type EphemeralDb,
} from "@/server/db/test-db";
import { activitySeries, tasks } from "@/server/db/schema";
import { createTask } from "@/server/dal";
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

const SCHEDULE_BODY = {
  tz: "America/New_York",
  dtstartLocal: new Date(Date.now() + 3_600_000).toISOString(),
  title: "Integration boundary block",
  durationMin: 25,
  source: "manual" as const,
};

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

async function activitySeriesCount(): Promise<number> {
  const [row] = await env!.db.select({ n: count() }).from(activitySeries);
  return Number(row?.n ?? 0);
}

describe("POST /api/v1/tasks/{id}/schedule integration (auth boundary)", () => {
  itDb("returns 401 and creates no series when unauthenticated", async () => {
    const aliceEmail = `alice-${uuidv7()}@integration.test`;
    const password = "integration-test-password-12";
    const alice = await signUpTestUser(auth, {
      email: aliceEmail,
      password,
      name: "Alice",
    });

    const task = await createTask(
      alice.userId,
      { bucket: "inbox", title: "Schedule me later" },
      { db: env!.db as Db },
    );

    const beforeSeries = await activitySeriesCount();

    const response = await POST(
      new Request(
        `http://127.0.0.1:3000/api/v1/tasks/${task.id}/schedule`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": uuidv7(),
          },
          body: JSON.stringify(SCHEDULE_BODY),
        },
      ),
      { params: Promise.resolve({ id: task.id }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "unauthorized" },
    });
    expect(await activitySeriesCount()).toBe(beforeSeries);

    const [unchanged] = await env!.db
      .select({
        convertedTo: tasks.convertedTo,
        deletedAt: tasks.deletedAt,
        revision: tasks.revision,
      })
      .from(tasks)
      .where(eq(tasks.id, task.id));
    expect(unchanged).toMatchObject({
      convertedTo: null,
      deletedAt: null,
      revision: 1,
    });
  });
});

describe("POST /api/v1/tasks/{id}/schedule integration (cross-user)", () => {
  itDb("returns 404 and leaves the owner's task unchanged", async () => {
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

    const task = await createTask(
      alice.userId,
      { bucket: "inbox", title: "Alice inbox task" },
      { db: env!.db as Db },
    );

    const beforeSeries = await activitySeriesCount();

    requestHeaders.current = new Headers({ cookie: mallory.cookieHeader });
    expect(mallory.userId).not.toBe(alice.userId);

    const response = await POST(
      new Request(
        `http://127.0.0.1:3000/api/v1/tasks/${task.id}/schedule`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": uuidv7(),
          },
          body: JSON.stringify({
            ...SCHEDULE_BODY,
            title: "Mallory overwrite",
          }),
        },
      ),
      { params: Promise.resolve({ id: task.id }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "not_found" },
    });
    expect(await activitySeriesCount()).toBe(beforeSeries);

    const [still] = await env!.db
      .select({
        title: tasks.title,
        userId: tasks.userId,
        convertedTo: tasks.convertedTo,
        deletedAt: tasks.deletedAt,
        revision: tasks.revision,
      })
      .from(tasks)
      .where(eq(tasks.id, task.id));
    expect(still).toEqual({
      title: "Alice inbox task",
      userId: alice.userId,
      convertedTo: null,
      deletedAt: null,
      revision: 1,
    });
  });
});
