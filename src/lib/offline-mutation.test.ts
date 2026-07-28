import { describe, expect, it, vi } from "vitest";
import {
  createOfflineMutationSender,
  type OfflineMutationDependencies,
} from "./offline-mutation";
import type { QueuedMutationInput } from "./offline-queue";

function response(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function harness(overrides: Partial<OfflineMutationDependencies> = {}) {
  const queued: Array<{ userId: string; mutation: QueuedMutationInput }> = [];
  const fetch = vi.fn(
    async (...args: Parameters<OfflineMutationDependencies["fetch"]>) => {
      void args;
      return response(201, { id: "created-1", revision: 1 });
    },
  );
  const dependencies: OfflineMutationDependencies = {
    fetch,
    enqueue: vi.fn(async (userId, mutation) => {
      queued.push({ userId, mutation });
      return { ...mutation, userId, createdAt: "2026-07-28T18:00:00Z", attempts: 0, status: "pending" };
    }),
    resolveUser: vi.fn(() => "user-1"),
    isOnline: vi.fn(() => true),
    uuid: vi.fn(() => "logical-key-1"),
    ...overrides,
  };
  return {
    sender: createOfflineMutationSender(dependencies),
    dependencies,
    fetch,
    queued,
  };
}

describe("sendReplaySafeCreate", () => {
  it("delivers immediately with one logical Idempotency-Key", async () => {
    const { sender, fetch, queued } = harness();

    const result = await sender.sendReplaySafeCreate({
      path: "/api/v1/tasks",
      body: { bucket: "inbox", title: "Call dentist" },
    });

    expect(result.state).toBe("server");
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/tasks",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "Idempotency-Key": "logical-key-1",
        }),
      }),
    );
    expect(queued).toHaveLength(0);
  });

  it("passes through a non-retryable 4xx without queueing", async () => {
    const { sender, queued } = harness({
      fetch: vi.fn(async () => response(400, { error: { message: "invalid" } })),
    });

    const result = await sender.sendReplaySafeCreate({
      path: "/api/v1/activities",
      body: { title: "" },
    });

    expect(result.state).toBe("server");
    if (result.state === "server") expect(result.response.status).toBe(400);
    expect(queued).toHaveLength(0);
  });

  it.each([429, 500, 503])(
    "queues retryable HTTP %s with the same key used by the first attempt",
    async (status) => {
      const queued: Array<{ userId: string; mutation: QueuedMutationInput }> = [];
      const fetch = vi.fn(
        async (...args: Parameters<OfflineMutationDependencies["fetch"]>) => {
          void args;
          return response(status);
        },
      );
      const enqueue = vi.fn(async (userId: string, mutation: QueuedMutationInput) => {
        queued.push({ userId, mutation });
        return { ...mutation, userId, createdAt: "now", attempts: 0, status: "pending" as const };
      });
      const { sender } = harness({ fetch, enqueue });

      const result = await sender.sendReplaySafeCreate({
        path: "/api/v1/mood",
        body: { mood: "good" },
      });

      expect(result).toEqual({ state: "queued" });
      const onlineHeaders = fetch.mock.calls[0]![1]!.headers as Record<string, string>;
      expect(onlineHeaders["Idempotency-Key"]).toBe("logical-key-1");
      expect(queued[0]!.mutation.idempotencyKey).toBe("logical-key-1");
    },
  );

  it("queues without fetching when already offline", async () => {
    const { sender, fetch, queued } = harness({
      isOnline: vi.fn(() => false),
    });

    const result = await sender.sendReplaySafeCreate({
      path: "/api/v1/routines",
      body: { title: "Morning reset" },
    });

    expect(result).toEqual({ state: "queued" });
    expect(fetch).not.toHaveBeenCalled();
    expect(queued[0]).toMatchObject({
      userId: "user-1",
      mutation: {
        method: "POST",
        path: "/api/v1/routines",
        idempotencyKey: "logical-key-1",
      },
    });
  });

  it("queues after a network exception", async () => {
    const { sender, queued } = harness({
      fetch: vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    });

    const result = await sender.sendReplaySafeCreate({
      path: "/api/v1/tasks",
      body: { bucket: "inbox", title: "Keep this" },
    });

    expect(result).toEqual({ state: "queued" });
    expect(queued).toHaveLength(1);
  });

  it("returns unavailable when no signed-in user can own the queue", async () => {
    const { sender } = harness({
      resolveUser: vi.fn(() => null),
      isOnline: vi.fn(() => false),
    });

    await expect(
      sender.sendReplaySafeCreate({
        path: "/api/v1/tasks",
        body: { bucket: "inbox", title: "Keep this" },
      }),
    ).resolves.toEqual({ state: "unavailable" });
  });

  it("returns unavailable when IndexedDB persistence fails", async () => {
    const { sender } = harness({
      isOnline: vi.fn(() => false),
      enqueue: vi.fn(async () => null),
    });

    await expect(
      sender.sendReplaySafeCreate({
        path: "/api/v1/tasks",
        body: { bucket: "inbox", title: "Keep this" },
      }),
    ).resolves.toEqual({ state: "unavailable" });
  });

  it("rejects a path outside the executable replay-safe allowlist", async () => {
    const { sender } = harness();

    await expect(
      sender.sendReplaySafeCreate({
        path: "/api/v1/calendar/ics" as "/api/v1/tasks",
        body: { url: "https://example.com/calendar.ics" },
      }),
    ).rejects.toThrow(/not replay-safe/);
  });
});

describe("sendRebasedStatusChange", () => {
  const body = {
    editScope: "this" as const,
    occurrenceKey: "2026-07-28T14:00:00.000Z",
    status: "completed" as const,
    completedAt: "2026-07-28T18:00:00.000Z",
  };

  it("uses the observed revision online", async () => {
    const { sender, fetch } = harness();

    const result = await sender.sendRebasedStatusChange({
      path: "/api/v1/activities/activity-1",
      body,
      onlineRevision: 6,
    });

    expect(result.state).toBe("server");
    const headers = fetch.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["If-Match"]).toBe("6");
  });

  it("queues without a pinned revision and rebases from the resource path", async () => {
    const { sender, queued } = harness({
      isOnline: vi.fn(() => false),
    });

    const result = await sender.sendRebasedStatusChange({
      path: "/api/v1/activities/activity-1",
      body,
      onlineRevision: 6,
    });

    expect(result).toEqual({ state: "queued" });
    expect(queued[0]!.mutation).toMatchObject({
      method: "PATCH",
      path: "/api/v1/activities/activity-1",
      rebasePath: "/api/v1/activities/activity-1",
      idempotencyKey: "logical-key-1",
    });
    expect(queued[0]!.mutation).not.toHaveProperty("headers");
  });

  it("rejects non-activity paths", async () => {
    const { sender } = harness();
    await expect(
      sender.sendRebasedStatusChange({
        path: "/api/v1/tasks/task-1" as `/api/v1/activities/${string}`,
        body,
        onlineRevision: 1,
      }),
    ).rejects.toThrow(/not a replay-safe activity status path/);
  });

  it("rejects general edits hidden in a status mutation", async () => {
    const { sender } = harness();
    await expect(
      sender.sendRebasedStatusChange({
        path: "/api/v1/activities/activity-1",
        body: { ...body, title: "Clobber" } as typeof body,
        onlineRevision: 1,
      }),
    ).rejects.toThrow(/not a status-only mutation/);
  });
});
