/**
 * Rate-limit framework — SEC-06 (ships WITH each endpoint, shared store).
 *
 * Postgres-backed sliding-window limiter so limits hold across replicas (the
 * `postgres` driver + a single row-per-bucket table). Phase 1C wires specific
 * limits to auth/AI/ICS/push/batch endpoints; this module provides the primitive.
 *
 * Design: each (bucket_key, window) pair has a row with a count and
 * window-start timestamp. On a request, atomically reset-if-expired then
 * increment; if count > limit → 429. The unique key is the bucket identifier
 * (e.g. "signup:ip:1.2.3.4" or "login:account:user@x.com").
 *
 * Why Postgres not Redis: no extra service to run, and Kairo already has one.
 * A `l_limit` table (created in migration 0002) holds the counters.
 */
import "server-only";
import dbDefault from "../db";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// Any drizzle postgres client (schema-agnostic — we only run raw SQL here).
type Db = PostgresJsDatabase<Record<string, unknown>>;

export interface RateLimitConfig {
  /** Max requests within the window. */
  limit: number;
  /** Window duration in seconds. */
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Seconds until the window resets (Retry-After). */
  retryAfterSec: number;
}

/**
 * Check (and consume) a rate-limit token. Returns whether the request is
 * allowed + metadata for 429 responses.
 *
 * Pass an explicit `db` only in tests; the app-wide client is used by default.
 */
export async function checkRateLimit(
  bucket: string,
  config: RateLimitConfig,
  opts: { db?: Db } = {},
): Promise<RateLimitResult> {
  const db = opts.db ?? dbDefault;
  // Single round-trip: reset the window if expired, then increment, returning
  // the new count + window start in one statement.
  const now = Date.now();
  const windowStartFloor = Math.floor(now / 1000 / config.windowSec) * config.windowSec;

  const rows = await db.execute<{
    new_count: string;
  }>(sql`
    INSERT INTO rate_limit_buckets (bucket, count, window_start, updated_at)
    VALUES (${bucket}, 1, to_timestamp(${windowStartFloor}), now())
    ON CONFLICT (bucket) DO UPDATE
      SET count = CASE
        WHEN rate_limit_buckets.window_start < to_timestamp(${windowStartFloor})
          THEN 1
        ELSE rate_limit_buckets.count + 1
      END,
      window_start = CASE
        WHEN rate_limit_buckets.window_start < to_timestamp(${windowStartFloor})
          THEN to_timestamp(${windowStartFloor})
        ELSE rate_limit_buckets.window_start
      END,
      updated_at = now()
    RETURNING count AS new_count, EXTRACT(EPOCH FROM (window_start + interval '${sql.raw(String(config.windowSec))} second' - now())) AS retry_after
  `);

  const row = (rows as unknown as { new_count: string }[])[0];
  const count = Number(row.new_count);
  const allowed = count <= config.limit;
  return {
    allowed,
    remaining: Math.max(0, config.limit - count),
    retryAfterSec: allowed ? 0 : config.windowSec,
  };
}

/**
 * Convenience: standard 429 response body for a blocked request.
 */
export function rateLimitedResponse(result: RateLimitResult) {
  return Response.json(
    {
      error: {
        code: "rate_limited",
        message: "Too many requests. Please retry shortly.",
        retryable: true,
        retryAfterSec: result.retryAfterSec,
      },
    },
    {
      status: 429,
      headers: {
        "retry-after": String(result.retryAfterSec),
        "cache-control": "no-store",
      },
    },
  );
}
