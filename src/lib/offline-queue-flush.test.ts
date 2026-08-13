/**
 * flushQueue drain contract (ADR-002 offline replay).
 *
 * Nothing in `pnpm test` exercised flushQueue — only the e2e spec did, which
 * `vitest run` never executes. A broken drain (dropping the per-user filter,
 * replaying in the wrong order, or failing to remove a delivered mutation) would
 * therefore ship green. These tests run the real IndexedDB path via
 * fake-indexeddb with fetch stubbed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  enqueueMutation,
  flushQueue,
  getPendingCount,
  getQueueSummary,
  rememberUser,
} from "./offline-queue";

/** Minimal localStorage stand-in — these tests run in the node environment. */
function installStorage() {
  const map = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

/** flushQueue dispatches CustomEvents on window when mutations land or conflict. */
function installWindow() {
  const events: string[] = [];
  vi.stubGlobal("window", {
    dispatchEvent: (e: Event) => {
      events.push(e.type);
      return true;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    CustomEvent,
  });
  return events;
}

let events: string[];

beforeEach(() => {
  // A fresh IndexedDB per test so queued rows never leak between cases.
  vi.stubGlobal("indexedDB", new IDBFactory());
  // enqueueMutation auto-flushes when online, so queue while offline and
  // go online explicitly before each drain.
  vi.stubGlobal("navigator", { onLine: false });
  installStorage();
  events = installWindow();
  rememberUser("user-1");
});

afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function goOnline() {
  vi.stubGlobal("navigator", { onLine: true });
}

function ok() {
  return Promise.resolve(
    new Response(JSON.stringify({ id: "srv-1", revision: 1 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

async function queueCapture(userId: string, title: string) {
  await enqueueMutation(userId, {
    method: "POST",
    path: "/api/v1/tasks",
    body: { bucket: "inbox", title },
    idempotencyKey: `key-${title}`,
  });
}

describe("flushQueue", () => {
  it("delivers a queued mutation once and clears it from the queue", async () => {
    const fetchMock = vi.fn(ok);
    vi.stubGlobal("fetch", fetchMock);

    await queueCapture("user-1", "buy milk");
    expect(await getPendingCount("user-1")).toBe(1);

    goOnline();
    await flushQueue("user-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await getPendingCount("user-1")).toBe(0);

    // A second flush must not re-send it — this is the duplicate-replay guard.
    goOnline();
    await flushQueue("user-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("replays in creation order", async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        seen.push(JSON.parse(String(init?.body)).title);
        return ok();
      }),
    );

    await queueCapture("user-1", "first");
    await queueCapture("user-1", "second");
    await queueCapture("user-1", "third");

    goOnline();
    await flushQueue("user-1");

    expect(seen).toEqual(["first", "second", "third"]);
  });

  it("never replays another user's mutations", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() => ok());
    vi.stubGlobal("fetch", fetchMock);

    await queueCapture("user-1", "mine");
    await queueCapture("user-2", "theirs");

    goOnline();
    await flushQueue("user-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)).title).toBe("mine");
    // The other account's capture is still queued, not stolen and not dropped.
    expect(await getPendingCount("user-2")).toBe(1);
  });

  it("keeps a 5xx mutation queued for retry instead of dropping it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("boom", { status: 503 }))),
    );

    await queueCapture("user-1", "flaky");
    goOnline();
    await flushQueue("user-1");

    expect(await getPendingCount("user-1")).toBe(1);
    const summary = await getQueueSummary("user-1");
    expect(summary.pending).toBe(1);
    expect(summary.terminal).toBe(0);
  });

  it("marks a 4xx mutation terminal so it stops retrying forever", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("nope", { status: 409 }))),
    );

    await queueCapture("user-1", "conflicted");
    goOnline();
    await flushQueue("user-1");

    const summary = await getQueueSummary("user-1");
    expect(summary.terminal).toBe(1);
    expect(summary.pending).toBe(0);
    expect(events).toContain("kairo:conflict");
  });

  it("stops the drain at the first retryable failure so order is preserved", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response("boom", { status: 503 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await queueCapture("user-1", "first");
    await queueCapture("user-1", "second");

    goOnline();
    await flushQueue("user-1");

    // Only the first was attempted; the second must not jump ahead of it.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await getPendingCount("user-1")).toBe(2);
  });
});
