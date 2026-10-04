/**
 * Task 4.1 — activity series mutation family: unauthenticated and cross-user
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
import { activitySeries } from "@/server/db/schema";
import { createActivitySeries, getActivitySeries } from "@/server/dal";
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
import { PATCH } from "./[id]/route";

const ACTIVITY_CREATE_BODY = {
  tz: "America/New_York",
  dtstartLocal: new Date(Date.now() + 3_600_000).toISOString(),
  title: "Integration boundary block",
  durationMin: 25,
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
  const [row] = await env!.db
    .select({ n: count() })
    .from(activitySeries);
  return Number(row?.n ?? 0);
}

describe("POST /api/v1/activities integration (auth boundary)", () => {
  itDb("returns 401 and creates no series when unauthenticated", async () => {
    const before = await activitySeriesCount();

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/v1/activities", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": uuidv7(),
        },
        body: JSON.stringify(ACTIVITY_CREATE_BODY),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "unauthorized" },
    });
    expect(await activitySeriesCount()).toBe(before);
  });
});

describe("PATCH /api/v1/activities/{id} integration (cross-user)", () => {
  itDb("returns 404 and leaves the owner's series unchanged", async () => {
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

    const owned = await createActivitySeries(
      alice.userId,
      {
        tz: "America/New_York",
        dtstartLocal: new Date(Date.now() + 3_600_000),
        rrule: null,
        title: "Alice original title",
        durationMin: 30,
      },
      { db: env!.db as Db },
    );

    requestHeaders.current = new Headers({ cookie: mallory.cookieHeader });
    expect(mallory.userId).not.toBe(alice.userId);

    const response = await PATCH(
      new Request(`http://127.0.0.1:3000/api/v1/activities/${owned.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "if-match": String(owned.revision),
          "idempotency-key": uuidv7(),
        },
        body: JSON.stringify({
          editScope: "all",
          title: "Mallory overwrite",
        }),
      }),
      { params: Promise.resolve({ id: owned.id }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "not_found" },
    });

    const still = await getActivitySeries(alice.userId, owned.id, {
      db: env!.db as Db,
    });
    expect(still.title).toBe("Alice original title");
    expect(still.revision).toBe(owned.revision);

    const leaked = await env!.db
      .select({ title: activitySeries.title, userId: activitySeries.userId })
      .from(activitySeries)
      .where(eq(activitySeries.id, owned.id));
    expect(leaked).toEqual([
      { title: "Alice original title", userId: alice.userId },
    ]);
  });
});
