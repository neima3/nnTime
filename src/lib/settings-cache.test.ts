/**
 * Pure unit tests for the module-level settings memo (getSettingsCached /
 * invalidateSettingsCache) — dedup within the 60s TTL, cache-busting on
 * failure/unauthenticated, and manual invalidation. fetch is mocked; the
 * module is freshly re-imported per test (vi.resetModules) since its cache
 * is module-level state we don't want to leak across tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("getSettingsCached / invalidateSettingsCache", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns parsed settings on a successful fetch", async () => {
    const settings = {
      timezone: "UTC",
      theme: "system" as const,
      reducedStimulation: false,
      hourCycle: "h24" as const,
      weekStart: 1,
      notificationPrefs: {},
      revision: 1,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => settings,
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getSettingsCached } = await import("./settings-cache");
    const result = await getSettingsCached();
    expect(result).toEqual(settings);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent + subsequent calls within the TTL to a single fetch", async () => {
    const settings = { timezone: "UTC", revision: 1 } as never;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => settings });
    vi.stubGlobal("fetch", fetchMock);

    const { getSettingsCached } = await import("./settings-cache");
    const [a, b] = await Promise.all([getSettingsCached(), getSettingsCached()]);
    const c = await getSettingsCached();
    expect(a).toEqual(settings);
    expect(b).toEqual(settings);
    expect(c).toEqual(settings);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refetches after the TTL expires", async () => {
    const settings = { timezone: "UTC", revision: 1 } as never;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => settings });
    vi.stubGlobal("fetch", fetchMock);

    const { getSettingsCached } = await import("./settings-cache");
    await getSettingsCached();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance past the 60s TTL.
    vi.setSystemTime(new Date("2026-07-18T12:01:01Z"));
    await getSettingsCached();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed response (res.ok=false) — the next call retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ timezone: "UTC", revision: 1 }) });
    vi.stubGlobal("fetch", fetchMock);

    const { getSettingsCached } = await import("./settings-cache");
    const first = await getSettingsCached();
    expect(first).toBeNull();

    // Even immediately after (well within TTL), a failed attempt must not be
    // cached — the next call should retry, not reuse the null result forever.
    const second = await getSettingsCached();
    expect(second).toEqual({ timezone: "UTC", revision: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("resolves null (not throw) on a network error, and does not poison the cache", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ timezone: "UTC", revision: 1 }) });
    vi.stubGlobal("fetch", fetchMock);

    const { getSettingsCached } = await import("./settings-cache");
    await expect(getSettingsCached()).resolves.toBeNull();
    await expect(getSettingsCached()).resolves.toEqual({ timezone: "UTC", revision: 1 });
  });

  it("invalidateSettingsCache forces the next call to refetch immediately", async () => {
    const settings = { timezone: "UTC", revision: 1 } as never;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => settings });
    vi.stubGlobal("fetch", fetchMock);

    const { getSettingsCached, invalidateSettingsCache } = await import("./settings-cache");
    await getSettingsCached();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    invalidateSettingsCache();
    await getSettingsCached();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("requests the correct endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const { getSettingsCached } = await import("./settings-cache");
    await getSettingsCached();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/settings");
  });
});
