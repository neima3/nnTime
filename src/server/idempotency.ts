/**
 * Idempotency-Key replay store (ADR-002).
 *
 * Client-generated UUID per logical mutation; server stores the response for
 * 48h and replays it on retry so offline/reconnect clients don't double-create.
 */
import "server-only";
import { and, eq, gt } from "drizzle-orm";
import db, { schema } from "@/server/db";

const TTL_MS = 48 * 60 * 60 * 1000;

const REPLAY_HEADERS = {
  "cache-control": "private, no-store",
  "idempotent-replay": "true",
} as const;

function replayResponse(status: number, body: unknown): Response {
  // Stored body is JSON-serializable (or null). Response.json(null) is fine.
  return Response.json(body ?? null, { status, headers: REPLAY_HEADERS });
}

async function lookup(
  userId: string,
  key: string,
): Promise<{ responseStatus: number; responseBody: unknown } | null> {
  const now = new Date();
  const rows = await db
    .select({
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
 * - Unknown key → execute; on status < 500, store for 48h. Concurrent first
 *   writers race on the composite PK; losers re-read and replay the winner.
 */
export async function withIdempotency(
  userId: string,
  key: string | null | undefined,
  method: string,
  path: string,
  execute: () => Promise<Response>,
): Promise<Response> {
  if (!key) return execute();

  const existing = await lookup(userId, key);
  if (existing) {
    return replayResponse(existing.responseStatus, existing.responseBody);
  }

  const response = await execute();

  // Don't cache server failures — client may retry after fix.
  if (response.status >= 500) return response;

  const body = await extractStorableBody(response);
  const expiresAt = new Date(Date.now() + TTL_MS);

  try {
    const inserted = await db
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
      .onConflictDoNothing()
      .returning({ key: schema.idempotencyKeys.key });

    // Lost the race, or an expired row still holds the PK.
    if (inserted.length === 0) {
      const winner = await lookup(userId, key);
      if (winner) {
        return replayResponse(winner.responseStatus, winner.responseBody);
      }
      // Expired key occupying PK — overwrite so the new response is stored.
      await db
        .update(schema.idempotencyKeys)
        .set({
          requestMethod: method,
          requestPath: path,
          responseStatus: response.status,
          responseBody: body,
          expiresAt,
          createdAt: new Date(),
        })
        .where(
          and(
            eq(schema.idempotencyKeys.userId, userId),
            eq(schema.idempotencyKeys.key, key),
          ),
        );
    }
  } catch {
    // PK conflict or other insert error → re-read and replay if present.
    const winner = await lookup(userId, key);
    if (winner) {
      return replayResponse(winner.responseStatus, winner.responseBody);
    }
  }

  return response;
}
