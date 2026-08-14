/**
 * Change log append (ADR-002 sync feed).
 *
 * Its own leaf module because every resource module writes to the change log,
 * while `events-changes.ts` reads user settings — keeping the append here is
 * what makes the DAL import graph acyclic.
 */
import "server-only";
import * as schema from "../db/schema";
import { sql } from "drizzle-orm";
import type { Db } from "./types";

/* -------------------------------------------------------------------------- */
/* Internal: append to change_log                                             */
/* -------------------------------------------------------------------------- */

export async function appendChangeLog(
  db: Db,
  userId: string,
  entityType: string,
  entityId: string,
  op: "upsert" | "delete",
  revision: number,
) {
  // ADR-002 sync reads `id > cursor`, and `id` comes from a global sequence
  // assigned at INSERT — not at COMMIT. Two concurrent writes for one account
  // (web + iOS, or two tabs) could therefore commit out of sequence order: if
  // id=12 commits while id=11 is still open, a poll returns 12, the client
  // advances its cursor past 11, and row 11 is never delivered — silent,
  // permanent data loss on sync.
  //
  // A transaction-scoped advisory lock keyed on the user makes id assignment
  // and commit order agree. It serializes only a single account's concurrent
  // mutations, which is negligible, and is released automatically on commit or
  // rollback.
  await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
  // Fail the mutation if change_log insert fails (callers wrap in transactions
  // so entity write + change_log stay atomic).
  await db.insert(schema.changeLog).values({
    userId,
    entityType,
    entityId,
    op,
    revision,
  });
}
