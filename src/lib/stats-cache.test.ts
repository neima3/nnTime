/**
 * Tests for the keyed stats memo (T16) — one fetch per window per TTL across
 * every Today-page consumer, per-key isolation, failure never cached, and
 * manual invalidation. fetch is mocked; the module is freshly re-imported per
 * test (vi.resetModules) since its cache is module-level state.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PAYLOAD = { estimate: { ratio: 1.4, sessions: 8 }, streak: { current: 2, best: 5 } };

function stubFetch(impl?: (url: string) => Promise<Response>) {
  const calls: string[] = [];
  const fn = vi.fn(async (url: string) => {
    calls.push(url);
    if (impl) return impl(url);
    return new Response(JSON.stringify(PAYLOAD), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

describe("getStatsCached / invalidateStatsCache", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("dedupes concurrent and repeat callers within the TTL", async () => {
    const calls = stubFetch();
    const { getStatsCached } = await import("./stats-cache");
    const [a, b] = await Promise.all([getStatsCached(30), getStatsCached(30)]);
    const c = await getStatsCached(30);
    expect(a).toEqual(PAYLOAD);
    expect(b).toEqual(PAYLOAD);
    expect(c).toEqual(PAYLOAD);
    expect(calls).toEqual(["/api/v1/stats?days=30"]);
  });

  it("keys the cache by window — different windows fetch independently", async () => {
    const calls = stubFetch();
    const { getStatsCached } = await import("./stats-cache");
    await getStatsCached(30);
    await getStatsCached(60);
    await getStatsCached();
    expect(calls).toEqual([
      "/api/v1/stats?days=30",
      "/api/v1/stats?days=60",
      "/api/v1/stats",
    ]);
  });

  it("expires entries after the TTL", async () => {
    const calls = stubFetch();
    const { getStatsCached } = await import("./stats-cache");
    await getStatsCached(30);
    vi.advanceTimersByTime(61_000);
    await getStatsCached(30);
    expect(calls).toHaveLength(2);
  });

  it("never caches a failed attempt (401 / network error)", async () => {
    let fail = true;
    const calls = stubFetch(async () => {
      if (fail) return new Response("nope", { status: 401 });
      return new Response(JSON.stringify(PAYLOAD), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const { getStatsCached } = await import("./stats-cache");
    expect(await getStatsCached(30)).toBeNull();
    fail = false;
    expect(await getStatsCached(30)).toEqual(PAYLOAD);
    expect(calls).toHaveLength(2);
  });

  it("invalidateStatsCache forces refetches on every key", async () => {
    const calls = stubFetch();
    const { getStatsCached, invalidateStatsCache } = await import("./stats-cache");
    await getStatsCached(30);
    await getStatsCached(60);
    invalidateStatsCache();
    await getStatsCached(30);
    await getStatsCached(60);
    expect(calls).toHaveLength(4);
  });
});
