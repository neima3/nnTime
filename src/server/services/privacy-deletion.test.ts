/**
 * Account deletion — SEC-10 regression tests.
 *
 * The bug these pin: `verification` (Better Auth) has no user_id and therefore
 * no FK cascade, so deleting the user left pending tokens behind. Magic-link
 * verify is `if (!user) if (!disableSignUp) createUser({emailVerified:true})`,
 * so a link issued before deletion and opened inside its TTL recreated the
 * account and minted a session — deletion was reversible for 15 minutes.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import {
  createEphemeralDb,
  insertUser,
  rethrowIfMigrationFailure,
  type EphemeralDb,
} from "../db/test-db";
import { deleteAccount } from "./privacy";

let env: EphemeralDb | null = null;
let dbAvailable = false;

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
  } catch (e) {
    rethrowIfMigrationFailure(e);
    dbAvailable = false;
  }
}, 60000);

afterAll(async () => {
  if (env) await env.teardown();
}, 60000);

// These cases assert on the whole verification table, so start each one clean.
beforeEach(async () => {
  if (env) await env.db.execute(sql`DELETE FROM verification`);
});

/** Skip (not pass) when Postgres is unavailable — honest CI signal. */
const itDb = (name: string, fn: (e: EphemeralDb) => Promise<void> | void) =>
  it(name, async ({ skip }) => {
    if (!dbAvailable || !env) {
      console.warn(`[SKIP] ${name}: Postgres unavailable`);
      skip(true, "Postgres unavailable");
      return;
    }
    await fn(env);
  });

async function seedVerification(
  e: EphemeralDb,
  identifier: string,
  value: string,
) {
  await e.db.execute(sql`
    INSERT INTO verification (id, identifier, value, expires_at)
    VALUES (${crypto.randomUUID()}, ${identifier}, ${value},
            now() + interval '15 minutes')
  `);
}

async function verificationCount(e: EphemeralDb): Promise<number> {
  const rows = await e.db.execute<{ n: string }>(
    sql`SELECT count(*)::text AS n FROM verification`,
  );
  return Number((rows as unknown as { n: string }[])[0]?.n ?? "0");
}

describe("SEC-10 account deletion revokes pending auth tokens", () => {
  itDb("removes the magic-link token that would resurrect the identity", async (e) => {
    const userId = crypto.randomUUID();
    const email = "resurrect@test.com";
    await insertUser(e.db, userId, email);
    // Exactly what better-auth's magic-link plugin stores.
    await seedVerification(e, "stored-token-abc", JSON.stringify({ email, name: "" }));

    await deleteAccount(userId, { db: e.db });

    expect(await verificationCount(e)).toBe(0);
  });

  itDb("removes the reset-password token, which stores the user id", async (e) => {
    const userId = crypto.randomUUID();
    await insertUser(e.db, userId, "reset@test.com");
    await seedVerification(e, `reset-password:${crypto.randomUUID()}`, userId);

    await deleteAccount(userId, { db: e.db });

    expect(await verificationCount(e)).toBe(0);
  });

  itDb("leaves another user's pending tokens alone", async (e) => {
    const victim = crypto.randomUUID();
    const bystander = crypto.randomUUID();
    await insertUser(e.db, victim, "victim@test.com");
    await insertUser(e.db, bystander, "bystander@test.com");
    await seedVerification(
      e,
      "victim-token",
      JSON.stringify({ email: "victim@test.com", name: "" }),
    );
    await seedVerification(
      e,
      "bystander-token",
      JSON.stringify({ email: "bystander@test.com", name: "" }),
    );

    await deleteAccount(victim, { db: e.db });

    const rows = await e.db.execute<{ identifier: string }>(
      sql`SELECT identifier FROM verification`,
    );
    const remaining = (rows as unknown as { identifier: string }[]).map(
      (r) => r.identifier,
    );
    expect(remaining).toEqual(["bystander-token"]);
  });

  itDb("an address containing a LIKE wildcard does not match other rows", async (e) => {
    const userId = crypto.randomUUID();
    const wildcard = "a%b@test.com";
    await insertUser(e.db, userId, wildcard);
    const other = crypto.randomUUID();
    await insertUser(e.db, other, "axxb@test.com");
    await seedVerification(e, "wild", JSON.stringify({ email: wildcard, name: "" }));
    await seedVerification(
      e,
      "literal",
      JSON.stringify({ email: "axxb@test.com", name: "" }),
    );

    await deleteAccount(userId, { db: e.db });

    const rows = await e.db.execute<{ identifier: string }>(
      sql`SELECT identifier FROM verification`,
    );
    const remaining = (rows as unknown as { identifier: string }[]).map(
      (r) => r.identifier,
    );
    expect(remaining).toEqual(["literal"]);
  });

  itDb("deletes the user row itself", async (e) => {
    const userId = crypto.randomUUID();
    await insertUser(e.db, userId, "gone@test.com");

    await deleteAccount(userId, { db: e.db });

    const rows = await e.db.execute<{ n: string }>(
      sql`SELECT count(*)::text AS n FROM "user" WHERE id = ${userId}`,
    );
    expect(Number((rows as unknown as { n: string }[])[0]?.n ?? "1")).toBe(0);
  });
});
