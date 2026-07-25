/**
 * Tests for the offline queue's user resolution.
 *
 * The queue itself needs IndexedDB (covered by the in-browser verification), but
 * `resolveQueueUser` is the piece that decides whether an offline capture can be
 * filed at all — and it exists because a real failure showed up on production:
 * `useSession()` had not resolved, so a signed-in user's offline capture was
 * refused with "this device can't hold it".
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rememberUser, resolveQueueUser } from "./offline-queue";

const KEY = "kairo-last-user";

/** Minimal localStorage stand-in — these tests run in the node environment. */
function installStorage(): { fail: () => void } {
  const map = new Map<string, string>();
  let broken = false;
  const store = {
    getItem: (k: string) => {
      if (broken) throw new Error("denied");
      return map.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (broken) throw new Error("denied");
      map.set(k, v);
    },
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
  (globalThis as { localStorage?: Storage }).localStorage = store;
  return { fail: () => { broken = true; } };
}

let handle: { fail: () => void };

beforeEach(() => {
  handle = installStorage();
});

afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe("resolveQueueUser", () => {
  it("returns the live session id and remembers it", () => {
    expect(resolveQueueUser("user-1")).toBe("user-1");
    expect(localStorage.getItem(KEY)).toBe("user-1");
  });

  it("falls back to the remembered id when the session hasn't resolved", () => {
    rememberUser("user-1");
    expect(resolveQueueUser(null)).toBe("user-1");
    expect(resolveQueueUser(undefined)).toBe("user-1");
  });

  it("returns null when nobody has ever signed in on this device", () => {
    expect(resolveQueueUser(null)).toBeNull();
  });

  it("prefers the live session over a stale remembered id", () => {
    rememberUser("old-user");
    expect(resolveQueueUser("new-user")).toBe("new-user");
    expect(localStorage.getItem(KEY)).toBe("new-user");
  });

  it("survives storage being unavailable (private mode / denied)", () => {
    handle.fail();
    expect(() => rememberUser("user-1")).not.toThrow();
    expect(resolveQueueUser(null)).toBeNull();
    // A live session id still works without storage.
    expect(resolveQueueUser("user-1")).toBe("user-1");
  });

  it("does nothing surprising with an empty string", () => {
    expect(resolveQueueUser("")).toBeNull();
  });
});
