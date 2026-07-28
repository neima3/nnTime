/**
 * Idempotency-Key replay store (ADR-002).
 *
 * Client-generated UUID per logical mutation; server stores the response for
 * 48h and replays it on retry so offline/reconnect clients don't double-create.
 */
import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import db, { schema } from "@/server/db";
import type { Db } from "@/server/dal";
import { errorResponse } from "@/server/api-errors";

const TTL_MS = 48 * 60 * 60 * 1000;

const REPLAY_HEADERS = {
  "cache-control": "private, no-store",
  "idempotent-replay": "true",
} as const;

function replayResponse(status: number, body: unknown): Response {
  if (status === 204) {
    return new Response(null, { status, headers: REPLAY_HEADERS });
  }
  return Response.json(body ?? null, { status, headers: REPLAY_HEADERS });
}

async function lookup(
  userId: string,
  key: string,
  database: Db = db,
): Promise<{
  requestMethod: string;
  requestPath: string;
  responseStatus: number;
  responseBody: unknown;
} | null> {
  const now = new Date();
  const rows = await database
    .select({
      requestMethod: schema.idempotencyKeys.requestMethod,
      requestPath: schema.idempotencyKeys.requestPath,
      responseStatus: schema.idempotencyKeys.responseStatus,
      responseBody: schema.idempotencyKeys.responseBody,
    })
    .from(schema.idempotencyKeys)
    .where(
      and(
        eq(schema.idempotencyKeys.userId, userId),
        eq(schema.idempotencyKeys.key, key),
        gt(schema.idempotencyKeys.expiresAt, now),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Extract a JSON/text body we can persist; never store streams. */
async function extractStorableBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  // 204 / empty: nothing to store
  if (response.status === 204) return null;

  try {
    const clone = response.clone();
    if (contentType.includes("application/json")) {
      return await clone.json();
    }
    const text = await clone.text();
    if (!text) return null;
    // Prefer structured JSON when the body is parseable JSON without a header
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

/**
 * Wrap a mutation handler with Idempotency-Key semantics.
 *
 * - No key → execute as-is.
 * - Known unexpired key → replay stored status + body (`idempotent-replay: true`).
 * - Unknown key → serialize by user/key, execute once, then store stable
 *   responses below 500 for 48h. A conflict is not stable: clients may re-read
 *   a fresh revision and retry the same logical mutation.
 */
export async function withIdempotency(
  userId: string,
  key: string | null | undefined,
  method: string,
  path: string,
  execute: (database: Db) => Promise<Response>,
  opts: { db?: Db } = {},
): Promise<Response> {
  const database = opts.db ?? (db as Db);
  if (!key) return execute(database);

  const lockKey = `${userId}:${key}`;
  return database.transaction(async (transaction) => {
    const lockedDb = transaction as unknown as Db;
    await lockedDb.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
    );

    const existing = await lookup(userId, key, lockedDb);
    if (existing) {
      if (
        existing.requestMethod !== method ||
        existing.requestPath !== path
      ) {
        return errorResponse(
          "idempotency_key_reused",
          "Idempotency-Key was already used for another operation",
          409,
          {
            details: {
              originalMethod: existing.requestMethod,
              originalPath: existing.requestPath,
            },
          },
        );
      }
      return replayResponse(existing.responseStatus, existing.responseBody);
    }

    const response = await execute(lockedDb);

    // Don't cache server failures or optimistic-concurrency conflicts — the
    // client may retry the same logical mutation after a fresh revision read.
    if (response.status >= 500 || response.status === 409) return response;

    const body = await extractStorableBody(response);
    const expiresAt = new Date(Date.now() + TTL_MS);
    await lockedDb
      .insert(schema.idempotencyKeys)
      .values({
        userId,
        key,
        requestMethod: method,
        requestPath: path,
        responseStatus: response.status,
        responseBody: body,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [schema.idempotencyKeys.userId, schema.idempotencyKeys.key],
        set: {
          requestMethod: method,
          requestPath: path,
          responseStatus: response.status,
          responseBody: body,
          expiresAt,
          createdAt: new Date(),
        },
      });

    return response;
  });
}
