/**
 * Task 4.1 — settings mutation family: unauthenticated and cross-user
 * boundaries at the HTTP handler (real requireSession + DAL), not mocked auth.
 *
 * Settings are a per-user singleton (PATCH /api/v1/settings, no id in URL).
 * Cross-user coverage proves Mallory's authenticated PATCH updates only her row
 * and Alice's settings row is byte-for-byte unchanged.
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
import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import type { Db } from "@/server/dal";
import {
  createEphemeralDb,
  rethrowIfMigrationFailure,
  type EphemeralDb,
} from "@/server/db/test-db";
import { userSettings } from "@/server/db/schema";
import { getOrCreateSettings, updateSettings } from "@/server/dal";
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
import { PATCH } from "./route";

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

async function settingsRow(userId: string) {
  const [row] = await env!.db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  return row;
}

describe("PATCH /api/v1/settings integration (auth boundary)", () => {
  itDb("returns 401 and changes no settings row when unauthenticated", async () => {
    const aliceEmail = `alice-${uuidv7()}@integration.test`;
    const password = "integration-test-password-12";
    const alice = await signUpTestUser(auth, {
      email: aliceEmail,
      password,
      name: "Alice",
    });
    const seeded = await getOrCreateSettings(alice.userId, { db: env!.db as Db });
    const aliceBefore = await settingsRow(alice.userId);
    expect(aliceBefore).toBeDefined();

    requestHeaders.current = new Headers();
    const response = await PATCH(
      new Request("http://127.0.0.1:3000/api/v1/settings", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "if-match": String(seeded.revision),
          "idempotency-key": uuidv7(),
        },
        body: JSON.stringify({ theme: "dark" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "unauthorized" },
    });
    expect(await settingsRow(alice.userId)).toEqual(aliceBefore);
  });
});

describe("PATCH /api/v1/settings integration (cross-user singleton)", () => {
  itDb(
    "updates only Mallory's row and leaves Alice's settings byte-for-byte unchanged",
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

      const aliceSeed = await getOrCreateSettings(alice.userId, {
        db: env!.db as Db,
      });
      await updateSettings(
        alice.userId,
        { theme: "light", reducedStimulation: true },
        aliceSeed.revision,
        { db: env!.db as Db },
      );
      const aliceBefore = await settingsRow(alice.userId);
      expect(aliceBefore?.theme).toBe("light");

      const mallorySeed = await getOrCreateSettings(mallory.userId, {
        db: env!.db as Db,
      });

      requestHeaders.current = new Headers({ cookie: mallory.cookieHeader });
      const response = await PATCH(
        new Request("http://127.0.0.1:3000/api/v1/settings", {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            "if-match": String(mallorySeed.revision),
            "idempotency-key": uuidv7(),
          },
          body: JSON.stringify({ theme: "dark" }),
        }),
      );

      expect(response.status).toBe(200);
      const malloryBody = await response.json();
      expect(malloryBody.theme).toBe("dark");
      expect(malloryBody.userId).toBe(mallory.userId);

      expect(await settingsRow(alice.userId)).toEqual(aliceBefore);

      const malloryAfter = await settingsRow(mallory.userId);
      expect(malloryAfter?.theme).toBe("dark");
      expect(malloryAfter?.userId).toBe(mallory.userId);
    },
  );
});
