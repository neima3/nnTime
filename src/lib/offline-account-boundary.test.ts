/**
 * P3.1 — account-boundary + recovery matrix for the web queue.
 *
 * Real IndexedDB via fake-indexeddb. fetch is stubbed; Storage is a map.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  adoptQueueUser,
  enqueueMutation,
  executeMutation,
  flushQueue,
  forgetUser,
  getPendingCount,
  getQueueSummary,
  peekRememberedUser,
  purgeUserCache,
  rememberUser,
  type QueuedMutation,
} from "./offline-queue";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  const storage: Storage = {
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
  return storage;
}

function installHarness() {
  const local = memoryStorage();
  const session = memoryStorage();
  (globalThis as { localStorage?: Storage }).localStorage = local;
  (globalThis as { sessionStorage?: Storage }).sessionStorage = session;
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("navigator", { onLine: false });
  const events: string[] = [];
  vi.stubGlobal("window", {
    dispatchEvent: (event: Event) => {
      events.push(event.type);
      return true;
    },
  });
  vi.stubGlobal(
    "CustomEvent",
    class<T> {
      constructor(
        public type: string,
        public init?: CustomEventInit<T>,
      ) {}
    },
  );
  return { local, session, events };
}

async function queueCapture(userId: string, title: string): Promise<void> {
  await enqueueMutation(userId, {
    method: "POST",
    path: "/api/v1/tasks",
    body: { bucket: "inbox", title },
    idempotencyKey: `key-${title}`,
  });
}

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  installHarness();
});

afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
  delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("purgeUserCache and account switch", () => {
  it("drops only that user's queue, prefixed cache, last-user, and onboarding draft", async () => {
    rememberUser("user-a");
    localStorage.setItem("kairo:user-a:secret", "a-private");
    localStorage.setItem("kairo:user-b:secret", "b-private");
    localStorage.setItem("kairo:onboarding", JSON.stringify({ draft: "A plan" }));
    sessionStorage.setItem("kairo:user-a:widget", "a-widget");
    await queueCapture("user-a", "A pending");
    await queueCapture("user-b", "B pending");

    await purgeUserCache("user-a");

    expect(await getPendingCount("user-a")).toBe(0);
    expect(await getPendingCount("user-b")).toBe(1);
    expect(localStorage.getItem("kairo:user-a:secret")).toBeNull();
    expect(localStorage.getItem("kairo:user-b:secret")).toBe("b-private");
    expect(localStorage.getItem("kairo:onboarding")).toBeNull();
    expect(sessionStorage.getItem("kairo:user-a:widget")).toBeNull();
    expect(peekRememberedUser()).toBeNull();
  });

  it("A→B adopt purges A so B cannot flush the old capture", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(201, { id: "task-1" }));
    vi.stubGlobal("fetch", fetchMock);
    rememberUser("user-a");
    await queueCapture("user-a", "Only for A");

    await expect(adoptQueueUser("user-b")).resolves.toBe("user-b");
    expect(peekRememberedUser()).toBe("user-b");
    expect(await getPendingCount("user-a")).toBe(0);
    expect(await getPendingCount("user-b")).toBe(0);

    vi.stubGlobal("navigator", { onLine: true });
    await flushQueue("user-b");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the remembered owner when the live session probe is empty", async () => {
    rememberUser("user-a");
    await queueCapture("user-a", "Keep me");
    await expect(adoptQueueUser(null)).resolves.toBe("user-a");
    expect(await getPendingCount("user-a")).toBe(1);
    expect(peekRememberedUser()).toBe("user-a");
  });

  it("forgetUser stops the signed-out device from owning a queue", () => {
    rememberUser("user-a");
    forgetUser();
    expect(peekRememberedUser()).toBeNull();
  });
});

describe("expired session and retryable failures", () => {
  it("keeps a 401 pending and does not mark a conflict", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(401, { error: { message: "Authentication required" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const setTimeout = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation((() => 1) as unknown as typeof globalThis.setTimeout);

    await queueCapture("user-a", "After expiry");
    vi.stubGlobal("navigator", { onLine: true });
    await flushQueue("user-a");

    await expect(getQueueSummary("user-a")).resolves.toEqual({
      pending: 1,
      terminal: 0,
    });
    expect(setTimeout).not.toHaveBeenCalled();
  });

  it("pauses on 403 owner mismatch instead of replaying as another account", async () => {
    vi.stubGlobal("fetch", async () =>
      jsonResponse(403, { error: { code: "queue_owner_mismatch" } }),
    );
    await queueCapture("user-a", "Stay with A");
    vi.stubGlobal("navigator", { onLine: true });
    await flushQueue("user-a");
    await expect(getQueueSummary("user-a")).resolves.toEqual({
      pending: 1,
      terminal: 0,
    });
  });

  it("backs off 429/5xx exponentially and caps at 30s", async () => {
    vi.stubGlobal("fetch", async () => jsonResponse(429, {}));
    const delays: number[] = [];
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      _fn: TimerHandler,
      ms?: number,
    ) => {
      delays.push(Number(ms));
      return 1;
    }) as unknown as typeof globalThis.setTimeout);

    await queueCapture("user-a", "Retry later");
    vi.stubGlobal("navigator", { onLine: true });

    for (let i = 0; i < 6; i++) {
      await flushQueue("user-a");
    }

    expect(delays).toEqual([1000, 2000, 4000, 8000, 16000, 30000]);
    expect(await getPendingCount("user-a")).toBe(1);
  });

  it("replays a lost response with the same Idempotency-Key", async () => {
    const keys: string[] = [];
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      keys.push(headers["Idempotency-Key"]);
      return jsonResponse(201, { id: "task-1" });
    });

    const mutation: QueuedMutation = {
      userId: "user-a",
      method: "POST",
      path: "/api/v1/tasks",
      body: { bucket: "inbox", title: "Once" },
      idempotencyKey: "same-logical-key",
      createdAt: "2026-09-13T12:00:00Z",
      attempts: 0,
      status: "pending",
    };
    await executeMutation(mutation);
    await executeMutation(mutation);
    expect(keys).toEqual(["same-logical-key", "same-logical-key"]);
  });
});

describe("enqueue classification guard", () => {
  it("refuses to persist a never-queued edit, delete, or focus transition", async () => {
    await expect(
      enqueueMutation("user-a", {
        method: "PATCH",
        path: "/api/v1/activities/act-1",
        body: { title: "Clobber", editScope: "all" },
        idempotencyKey: "edit-key",
      }),
    ).rejects.toThrow(/not queueable offline/);
    await expect(
      enqueueMutation("user-a", {
        method: "DELETE",
        path: "/api/v1/tasks/task-1",
        idempotencyKey: "del-key",
      }),
    ).rejects.toThrow(/not queueable offline/);
    await expect(
      enqueueMutation("user-a", {
        method: "POST",
        path: "/api/v1/focus-sessions",
        body: { title: "Focus", durationMin: 25 },
        idempotencyKey: "focus-key",
      }),
    ).rejects.toThrow(/not queueable offline/);
    expect(await getPendingCount("user-a")).toBe(0);
  });
});
