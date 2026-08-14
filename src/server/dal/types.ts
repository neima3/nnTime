/**
 * Shared DAL types (ADR-005). Leaf module: imported by every resource module,
 * imports none of them.
 */
import "server-only";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// Schema-agnostic drizzle client type so both the app instance and ephemeral
// test DBs are accepted.
export type Db = PostgresJsDatabase<Record<string, unknown>>;
