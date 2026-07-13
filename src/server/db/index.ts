/**
 * Server-only database access. Importing this module from a Client Component
 * is a build error (`server-only`), enforcing ADR-002's "no DB/auth imports in
 * Client Components". Route handlers and Server Components share this client.
 *
 * The drizzle instance is created lazily from `DATABASE_URL`. Tests import
 * `createDb` directly with their own connection (see src/server/db/test-utils.ts).
 */
import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { ensureMigrated } from "./migrate-on-startup";

export * as schema from "./schema";

// Run migrations on first import (once per process). This guarantees tables
// exist before any query, without a separate migration command.
ensureMigrated();

/** Create a drizzle client bound to a specific connection string. */
export function createDb(connectionString: string) {
  const queryClient = postgres(connectionString, { max: 10 });
  return drizzle(queryClient, { schema });
}

/**
 * App-wide client. In production/staging `DATABASE_URL` points at the Coolify
 * managed Postgres (see docs/DEPLOYMENT.md). Locally: Homebrew pg@17.
 */
const db = createDb(process.env.DATABASE_URL ?? "postgresql://localhost/kairo_dev");

export default db;
