import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingSignOut,
  completeServerSignOut,
  flushPendingSignOut,
  hasPendingSignOut,
  markPendingSignOut,
} from "./pending-sign-out";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

beforeEach(() => {
  (globalThis as { sessionStorage?: Storage }).sessionStorage = memoryStorage();
  vi.stubGlobal("navigator", { onLine: true });
});

afterEach(() => {
  delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("pending sign-out", () => {
  it("retries the server sign-out after a failed offline attempt", async () => {
    markPendingSignOut();
    expect(hasPendingSignOut()).toBe(true);

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(flushPendingSignOut()).rejects.toThrow(/Failed to fetch/);
    expect(hasPendingSignOut()).toBe(true);

    await flushPendingSignOut();
    expect(hasPendingSignOut()).toBe(false);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/auth/sign-out", {
      method: "POST",
      credentials: "include",
    });
  });

  it("does not fire the server sign-out while still offline", async () => {
    markPendingSignOut();
    vi.stubGlobal("navigator", { onLine: false });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await flushPendingSignOut();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(hasPendingSignOut()).toBe(true);
  });

  it("treats an already-cleared session as success", async () => {
    markPendingSignOut();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    await completeServerSignOut();
    expect(hasPendingSignOut()).toBe(false);
  });

  it("clearPendingSignOut drops the durable flag", () => {
    markPendingSignOut();
    clearPendingSignOut();
    expect(hasPendingSignOut()).toBe(false);
  });
});
