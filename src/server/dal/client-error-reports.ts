/**
 * Client error reports (ADR-005 SEC-01) — 6.2 `client_error_reports`.
 *
 * Write-once telemetry, not a synced planner resource: no revision, no
 * change_log append. Every query scopes by the authenticated session's
 * userId IN THE SAME PREDICATE. See `./index.ts` for the DAL-wide contract.
 *
 * `createClientErrorReport` takes the SESSION userId as an explicit
 * parameter and never reads an owner off the input — the route handler is
 * the only caller, and it must pass `requireSession().userId`, never a
 * client-supplied field.
 */
import "server-only";
import dbDefault from "../db";
import * as schema from "../db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "./types";

export interface CreateClientErrorReportInput {
  name: string;
  message: string;
  stack?: string | null;
  path?: string | null;
  release?: string | null;
}

/**
 * Insert one (already-redacted — see src/server/redact.ts) error report.
 * `userId` is the session's id; the caller must not accept it from the
 * client body.
 */
export async function createClientErrorReport(
  userId: string,
  input: CreateClientErrorReportInput,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  const [row] = await db
    .insert(schema.clientErrorReports)
    .values({
      id: crypto.randomUUID(),
      userId,
      name: input.name,
      message: input.message,
      stack: input.stack ?? null,
      path: input.path ?? null,
      release: input.release ?? null,
    })
    .returning();
  return row!;
}

/**
 * List the authenticated user's own error reports, most recent first. Not
 * wired to a route yet — exists for the isolation test and a future
 * diagnostics surface (SEC-01: scoped by userId in the same predicate as
 * every other DAL read).
 */
export async function listClientErrorReports(
  userId: string,
  opts: { db?: Db; limit?: number } = {},
) {
  const db = opts.db ?? dbDefault;
  return db
    .select()
    .from(schema.clientErrorReports)
    .where(and(eq(schema.clientErrorReports.userId, userId)))
    .orderBy(desc(schema.clientErrorReports.createdAt))
    .limit(opts.limit ?? 100);
}
