/**
 * Test DB utilities — creates and tears down an ephemeral Postgres database
 * per test file so DB integration tests are fully isolated.
 *
 * The ephemeral DB is created from a random name on the server pointed at by
 * TEST_DATABASE_URL (default: local Homebrew pg). Migrations are applied fresh.
 */
import { execSync } from "node:child_process";
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
 * Create an isolated ephemeral DB, run all migrations against it, and return
 * a drizzle client + teardown. The DB is dropped on teardown.
 */
export async function createEphemeralDb(): Promise<EphemeralDb> {
  const { base, host, port, maintenanceDb } = parseUrl(ROOT_URL);
  const dbName = `kairo_eph_${randomBytes(4).toString("hex")}`;
  const socketHost = host === "localhost" ? "/tmp" : host;

  // CREATE DATABASE (idempotent retry — connection via maintenance db).
  const createSql = `CREATE DATABASE ${dbName};`;
  const hostFlag = socketHost === "/tmp" ? `-h /tmp` : `-h ${host} -p ${port}`;
  try {
    execSync(
      `psql ${hostFlag} -d ${maintenanceDb} -v ON_ERROR_STOP=1 -c "${createSql}"`,
      { stdio: "pipe" },
    );
  } catch (e) {
    throw new Error(
      `could not create ephemeral DB ${dbName} (is Postgres running at ${host}:${port}?): ${(e as Error).message}`,
    );
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
      await sql.unsafe(stmt);
    }
  }

  const teardown = async () => {
    try {
      await sql.end({ timeout: 5 });
    } catch {
      /* ignore */
    }
    try {
      execSync(
        `psql ${hostFlag} -d ${maintenanceDb} -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${dbName};"`,
        { stdio: "pipe" },
      );
    } catch {
      /* best effort */
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
  await db.insert(schema.users).values({ id, email });
}
