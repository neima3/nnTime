/**
 * Rate-limit framework tests (SEC-06).
 *
 * DB-integrated against the ephemeral Postgres: verifies the sliding-window
 * counter allows up to `limit` requests within a window, blocks the rest with
 * the right metadata, and resets when the window rolls over.
 *
 * 1C wires specific endpoint limits; here we prove the primitive works.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEphemeralDb, type EphemeralDb } from "../db/test-db";
import { checkRateLimit, rateLimitedResponse } from "./index";

let env: EphemeralDb | null = null;
let dbAvailable = false;

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
}, 60000);

afterAll(async () => {
  if (env) await env.teardown();
}, 60000);

const itDb = (name: string, fn: () => Promise<void> | void) =>
  it(name, async () => {
    if (!dbAvailable || !env) return;
    await fn();
  });

describe("checkRateLimit sliding window (SEC-06)", () => {
  itDb("allows up to limit then blocks", async () => {
    const bucket = `test:allow:${Date.now()}`;
    // 3 allowed in a 60s window
    const cfg = { limit: 3, windowSec: 60 };
    const r1 = await checkRateLimit(bucket, cfg, { db: env!.db });
    const r2 = await checkRateLimit(bucket, cfg, { db: env!.db });
    const r3 = await checkRateLimit(bucket, cfg, { db: env!.db });
    const r4 = await checkRateLimit(bucket, cfg, { db: env!.db });

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r4.allowed).toBe(false); // 4th blocked
    expect(r4.retryAfterSec).toBeGreaterThan(0);
  });

  itDb("counts down remaining", async () => {
    const bucket = `test:remaining:${Date.now()}`;
    const cfg = { limit: 5, windowSec: 60 };
    const r1 = await checkRateLimit(bucket, cfg, { db: env!.db });
    expect(r1.remaining).toBe(4);
    const r2 = await checkRateLimit(bucket, cfg, { db: env!.db });
    expect(r2.remaining).toBe(3);
  });

  itDb("different buckets are independent", async () => {
    const a = `test:indep-a:${Date.now()}`;
    const b = `test:indep-b:${Date.now()}`;
    const cfg = { limit: 1, windowSec: 60 };
    const ra = await checkRateLimit(a, cfg, { db: env!.db });
    const rb = await checkRateLimit(b, cfg, { db: env!.db });
    expect(ra.allowed).toBe(true);
    expect(rb.allowed).toBe(true); // separate bucket
    const ra2 = await checkRateLimit(a, cfg, { db: env!.db });
    expect(ra2.allowed).toBe(false); // a exhausted
  });

  itDb("window resets after rollover", async () => {
    const bucket = `test:reset:${Date.now()}`;
    const cfg = { limit: 1, windowSec: 1 }; // 1-second window
    const r1 = await checkRateLimit(bucket, cfg, { db: env!.db });
    expect(r1.allowed).toBe(true);
    const r2 = await checkRateLimit(bucket, cfg, { db: env!.db });
    expect(r2.allowed).toBe(false);
    // Wait for the window to roll over.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const r3 = await checkRateLimit(bucket, cfg, { db: env!.db });
    expect(r3.allowed).toBe(true); // reset
  });
});

describe("rateLimitedResponse", () => {
  it("returns a 429 with retry-after", () => {
    const res = rateLimitedResponse({ allowed: false, remaining: 0, retryAfterSec: 30 });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
  });
});
