/**
 * Test DB utilities — creates and tears down an ephemeral Postgres database
 * per test file so DB integration tests are fully isolated.
 *
 * The ephemeral DB is created from a random name on the server pointed at by
 * TEST_DATABASE_URL (default: local Homebrew pg). Migrations are applied fresh.
 */
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const ROOT_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://nn@localhost:5432/kairo_test";

export interface EphemeralDb {
  url: string;
  dbName: string;
  db: ReturnType<typeof drizzle>;
  sql: ReturnType<typeof postgres>;
  teardown: () => Promise<void>;
}

function parseUrl(url: string) {
  const m = url.match(/^(postgresql:\/\/[^@]*@([^:/]+)(?::(\d+))?\/)([^?]+)/);
  if (!m) throw new Error(`cannot parse TEST_DATABASE_URL: ${url}`);
  return {
    base: m[1], // postgresql://user@host:port/
    host: m[2],
    port: m[3] ?? "5432",
    maintenanceDb: m[4],
  };
}

/**
 * A migration file failed to apply. Distinct from "Postgres isn't running" on
 * purpose: DB test files skip themselves when there's no server (CI without a
 * pg service), and that skip used to swallow migration breakage too — nine test
 * files reported green while asserting nothing after 0006 started failing on
 * fresh databases. Callers must rethrow this one.
 */
export class MigrationFailure extends Error {
  constructor(
    readonly file: string,
    cause: unknown,
  ) {
    super(
      `migration ${file} failed to apply to the ephemeral DB: ${
        (cause as Error)?.message ?? String(cause)
      }`,
    );
    this.name = "MigrationFailure";
    this.cause = cause;
  }
}

/**
 * Rethrow migration breakage; report anything else as an unavailable server.
 * Every DB test's `beforeAll` catch block runs this first, so a broken chain
 * fails the suite instead of silently disabling it.
 */
export function rethrowIfMigrationFailure(e: unknown): void {
  if (e instanceof MigrationFailure) throw e;
}

/**
 * Create an isolated ephemeral DB, run all migrations against it, and return
 * a drizzle client + teardown. The DB is dropped on teardown.
 */
export async function createEphemeralDb(): Promise<EphemeralDb> {
  const { base, host, port, maintenanceDb } = parseUrl(ROOT_URL);
  const dbName = `kairo_eph_${randomBytes(4).toString("hex")}`;

  // CREATE DATABASE via the same TCP path the data connection below uses.
  // (This used to shell out to psql through the Homebrew /tmp socket for
  // localhost, which no CI service container provides — every DB integration
  // test silently skipped in CI while reporting green locally.)
  const adminUrl = `${base}${maintenanceDb}`;
  const admin = postgres(adminUrl, { max: 1 });
  try {
    await admin.unsafe(`CREATE DATABASE ${dbName}`);
  } catch (e) {
    throw new Error(
      `could not create ephemeral DB ${dbName} (is Postgres running at ${host}:${port}?): ${(e as Error).message}`,
    );
  } finally {
    await admin.end({ timeout: 5 }).catch(() => {});
  }

  const url = `${base}${dbName}`;
  const sql = postgres(url, { max: 5 });
  const db = drizzle(sql, { schema });

  // Apply migrations in order.
  const drizzleDir = resolve(process.cwd(), "drizzle");
  const migrationFiles = readdirSync(drizzleDir)
    .filter((f: string) => /^\d{4}_.*\.sql$/.test(f))
    .sort();
  for (const file of migrationFiles) {
    const sqlText = readFileSync(resolve(drizzleDir, file), "utf8");
    // drizzle migrations use --> statement-breakpoint separators.
    const statements = sqlText
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      try {
        await sql.unsafe(stmt);
      } catch (e) {
        await sql.end({ timeout: 5 }).catch(() => {});
        throw new MigrationFailure(file, e);
      }
    }
  }

  const teardown = async () => {
    try {
      await sql.end({ timeout: 5 });
    } catch {
      /* ignore */
    }
    const dropper = postgres(adminUrl, { max: 1 });
    try {
      await dropper.unsafe(`DROP DATABASE IF EXISTS ${dbName}`);
    } catch {
      /* best effort */
    } finally {
      await dropper.end({ timeout: 5 }).catch(() => {});
    }
  };

  return { url, dbName, db, sql, teardown };
}

/** Insert a minimal user row (for FK targets in tests). Returns the new id. */
export async function insertUser(
  db: EphemeralDb["db"],
  id: string,
  email = `${id}@test.com`,
): Promise<void> {
  await db.insert(schema.users).values({ id, email, name: "Test User", emailVerified: true });
}
