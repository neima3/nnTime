/**
 * Local-only Postgres admin helpers for backup/restore rehearsal tests.
 * Never targets production — callers use ephemeral DB names from test-db.
 */
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import postgres from "postgres";

const execFileAsync = promisify(execFile);

export interface ParsedDatabaseUrl {
  adminBase: string;
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

/** Parse a postgres URL into connection parts (password may be empty). */
export function parseDatabaseUrl(url: string): ParsedDatabaseUrl {
  const m = url.match(
    /^postgresql:\/\/(?:([^:@/]*)(?::([^@/]*))?@)?([^:/]+)(?::(\d+))?\/([^?]+)/,
  );
  if (!m) throw new Error(`cannot parse database URL: ${url}`);
  const user = decodeURIComponent(m[1] ?? "");
  const password = decodeURIComponent(m[2] ?? "");
  const host = m[3];
  const port = m[4] ?? "5432";
  const database = m[5];
  const auth =
    user.length > 0
      ? `${encodeURIComponent(user)}${password.length > 0 ? `:${encodeURIComponent(password)}` : ""}@`
      : "";
  return {
    adminBase: `postgresql://${auth}${host}:${port}/`,
    host,
    port,
    user,
    password,
    database,
  };
}

function pgEnv(password: string): NodeJS.ProcessEnv {
  return password ? { ...process.env, PGPASSWORD: password } : process.env;
}

/** Custom-format dump of one database (pg_dump -Fc). */
export async function pgDumpCustom(url: string, outfile: string): Promise<void> {
  const { host, port, user, password, database } = parseDatabaseUrl(url);
  await execFileAsync(
    "pg_dump",
    ["-h", host, "-p", port, "-U", user, "-d", database, "-Fc", "-f", outfile],
    { env: pgEnv(password) },
  );
}

/** Restore a custom dump into an existing empty database. */
export async function pgRestoreCustom(
  adminUrl: string,
  targetDb: string,
  dumpPath: string,
): Promise<void> {
  const { host, port, user, password } = parseDatabaseUrl(adminUrl);
  await execFileAsync(
    "pg_restore",
    [
      "-h",
      host,
      "-p",
      port,
      "-U",
      user,
      "-d",
      targetDb,
      "--no-owner",
      "--no-acl",
      dumpPath,
    ],
    { env: pgEnv(password) },
  );
}

export async function createEmptyDatabase(adminUrl: string, dbName: string): Promise<void> {
  const sql = postgres(adminUrl, { max: 1 });
  try {
    await sql.unsafe(`CREATE DATABASE ${dbName}`);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

export function maintenanceUrlFromDatabaseUrl(url: string): string {
  const { adminBase } = parseDatabaseUrl(url);
  return `${adminBase}postgres`;
}

export async function dropDatabase(adminUrl: string, dbName: string): Promise<void> {
  const sql = postgres(adminUrl, { max: 1 });
  try {
    await sql.unsafe(`DROP DATABASE IF EXISTS ${dbName}`);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

/** True when pg_dump/pg_restore binaries exist (Linux CI and dev machines). */
export function pgCliAvailable(): boolean {
  try {
    execFileSync("pg_dump", ["--version"], { stdio: "ignore" });
    execFileSync("pg_restore", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
