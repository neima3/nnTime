/**
 * Rate limiting middleware for production API routes.
 * Uses the rate_limit_buckets table (Postgres-backed, shared across replicas).
 * 
 * Limits:
 * - Auth endpoints (signup/login/magic-link): 10 requests / 10 min per IP
 * - AI endpoints: 50 requests / 24h per user (atomic quota, SEC-05)
 * - General API: 100 requests / 1 min per user
 */
import "server-only";
import dbDefault from "../db";
import { sql } from "drizzle-orm";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

async function checkLimit(
  bucket: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / 1000 / windowSec) * windowSec;

  try {
    const rows = await dbDefault.execute<{
      new_count: string;
    }>(sql`
      INSERT INTO rate_limit_buckets (bucket, count, window_start, updated_at)
      VALUES (${bucket}, 1, to_timestamp(${windowStart}), now())
      ON CONFLICT (bucket) DO UPDATE
        SET count = CASE
          WHEN rate_limit_buckets.window_start < to_timestamp(${windowStart})
            THEN 1
          ELSE rate_limit_buckets.count + 1
        END,
        window_start = CASE
          WHEN rate_limit_buckets.window_start < to_timestamp(${windowStart})
            THEN to_timestamp(${windowStart})
          ELSE rate_limit_buckets.window_start
        END,
        updated_at = now()
      RETURNING count AS new_count
    `);

    const count = Number((rows as unknown as { new_count: string }[])[0]?.new_count ?? 0);
    const allowed = count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - count),
      retryAfterSec: allowed ? 0 : windowSec,
    };
  } catch {
    // If rate limiting fails, allow the request (fail-open for availability)
    return { allowed: true, remaining: 99, retryAfterSec: 0 };
  }
}

/** Rate limit for auth endpoints: 10 requests / 10 min per IP */
export async function limitAuth(ip: string): Promise<RateLimitResult> {
  return checkLimit(`auth:ip:${ip}`, 10, 600);
}

/** Rate limit for AI endpoints: 50 requests / 24h per user */
export async function limitAI(userId: string): Promise<RateLimitResult> {
  const dateKey = new Date().toISOString().slice(0, 10);
  return checkLimit(`ai:user:${userId}:${dateKey}`, 50, 86400);
}

/** Rate limit for general API: 100 requests / 1 min per user */
export async function limitAPI(userId: string): Promise<RateLimitResult> {
  return checkLimit(`api:user:${userId}`, 100, 60);
}

/** Rate limit for ICS import: 5 per hour per user */
export async function limitICS(userId: string): Promise<RateLimitResult> {
  return checkLimit(`ics:user:${userId}`, 5, 3600);
}

/** Rate limit for push subscription: 10 per hour per user */
export async function limitPush(userId: string): Promise<RateLimitResult> {
  return checkLimit(`push:user:${userId}`, 10, 3600);
}
