/**
 * Tests for the offline queue's user resolution.
 *
 * The queue itself needs IndexedDB (covered by the in-browser verification), but
 * `resolveQueueUser` is the piece that decides whether an offline capture can be
 * filed at all — and it exists because a real failure showed up on production:
 * `useSession()` had not resolved, so a signed-in user's offline capture was
 * refused with "this device can't hold it".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  dismissTerminalMutations,
  enqueueMutation,
  getQueueSummary,
  rememberUser,
  resolveQueueUser,
  executeMutation,
  type QueuedMutation,
} from "./offline-queue";

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
  vi.unstubAllGlobals();
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

/**
 * Rebase-on-replay (ADR-002 §offline mutation classes): a queued status change
 * carries no pinned revision — at flush time the queue re-reads the resource
 * and uses the fresh revision as If-Match. These tests pin that contract.
 */
describe("executeMutation rebase-on-replay", () => {
  const baseMutation: QueuedMutation = {
    userId: "user-1",
    method: "PATCH",
    path: "/api/v1/activities/act-1",
    rebasePath: "/api/v1/activities/act-1",
    body: { editScope: "this", status: "completed" },
    idempotencyKey: "key-1",
    createdAt: "2026-07-26T12:00:00Z",
    attempts: 0,
    status: "pending",
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  it("re-reads the resource and replays with the fresh revision as If-Match", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (!init) return jsonResponse(200, { id: "act-1", revision: 7 });
      return jsonResponse(200, { id: "act-1", revision: 8 });
    });

    const result = await executeMutation(baseMutation);
    expect(result).toEqual({ success: true, terminal: false });
    expect(calls).toHaveLength(2);
    // First call is the bare re-read, second the PATCH with the fresh revision.
    expect(calls[0].init).toBeUndefined();
    const headers = calls[1].init?.headers as Record<string, string>;
    expect(headers["If-Match"]).toBe("7");
    expect(headers["Idempotency-Key"]).toBe("key-1");
    expect(calls[1].init?.method).toBe("PATCH");
  });

  it("is terminal when the item was deleted while offline (404 on re-read)", async () => {
    vi.stubGlobal("fetch", async () => jsonResponse(404, { error: { message: "gone" } }));
    const result = await executeMutation(baseMutation);
    expect(result.terminal).toBe(true);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/deleted while you were offline/);
  });

  it("retries (not terminal) when the re-read hits a 5xx", async () => {
    vi.stubGlobal("fetch", async () => jsonResponse(503, {}));
    const result = await executeMutation(baseMutation);
    expect(result).toMatchObject({ success: false, terminal: false });
  });

  it("retries a 409 on the replay — the next flush re-reads again", async () => {
    let first = true;
    vi.stubGlobal("fetch", async () => {
      if (first) {
        first = false;
        return jsonResponse(200, { revision: 7 });
      }
      return jsonResponse(409, { error: { message: "conflict" } });
    });
    const result = await executeMutation(baseMutation);
    expect(result).toMatchObject({ success: false, terminal: false });
  });

  it("keeps a 409 terminal for non-rebase mutations (pinned revision truly stale)", async () => {
    vi.stubGlobal("fetch", async () => jsonResponse(409, { error: { message: "conflict" } }));
    const result = await executeMutation({ ...baseMutation, rebasePath: undefined });
    expect(result.terminal).toBe(true);
  });

  it("is terminal when the re-read returns a body without a revision", async () => {
    vi.stubGlobal("fetch", async () => jsonResponse(200, { id: "act-1" }));
    const result = await executeMutation(baseMutation);
    expect(result.terminal).toBe(true);
  });

  it("retries on a network error during the re-read", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    const result = await executeMutation(baseMutation);
    expect(result).toMatchObject({ success: false, terminal: false });
  });
});

describe("durable queue summary and terminal acknowledgment", () => {
  beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("navigator", { onLine: false });
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    vi.stubGlobal(
      "CustomEvent",
      class<T> {
        constructor(
          public type: string,
          public init?: CustomEventInit<T>,
        ) {}
      },
    );
  });

  async function markTerminal(userId: string): Promise<void> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("kairo-offline", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = await new Promise<QueuedMutation[]>((resolve, reject) => {
      const request = db.transaction("mutations", "readonly")
        .objectStore("mutations")
        .getAll();
      request.onsuccess = () => resolve(request.result as QueuedMutation[]);
      request.onerror = () => reject(request.error);
    });
    const row = rows.find(
      (candidate) => candidate.userId === userId && candidate.status === "pending",
    )!;
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("mutations", "readwrite");
      transaction.objectStore("mutations").put({
        ...row,
        status: "terminal",
        lastError: "conflict",
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }

  async function queue(userId: string, suffix: string): Promise<void> {
    await enqueueMutation(userId, {
      method: "POST",
      path: "/api/v1/tasks",
      body: { bucket: "inbox", title: suffix },
      idempotencyKey: `key-${suffix}`,
    });
  }

  it("counts pending and terminal rows for only the requested user", async () => {
    await queue("user-a", "a-pending");
    await queue("user-a", "a-terminal");
    await queue("user-b", "b-terminal");
    await markTerminal("user-a");
    await markTerminal("user-b");

    await expect(getQueueSummary("user-a")).resolves.toEqual({
      pending: 1,
      terminal: 1,
    });
    await expect(getQueueSummary("user-b")).resolves.toEqual({
      pending: 0,
      terminal: 1,
    });
  });

  it("dismisses only this user's terminal rows", async () => {
    await queue("user-a", "a-pending");
    await queue("user-a", "a-terminal");
    await queue("user-b", "b-terminal");
    await markTerminal("user-a");
    await markTerminal("user-b");

    await dismissTerminalMutations("user-a");

    await expect(getQueueSummary("user-a")).resolves.toEqual({
      pending: 1,
      terminal: 0,
    });
    await expect(getQueueSummary("user-b")).resolves.toEqual({
      pending: 0,
      terminal: 1,
    });
  });
});
