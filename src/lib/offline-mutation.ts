"use client";

import {
  enqueueMutation,
  resolveQueueUser,
  type EnqueueMutationOptions,
  type QueuedMutation,
  type QueuedMutationInput,
} from "./offline-queue";
import { QUEUE_OWNER_HEADER } from "./queue-ownership";

export type ReplaySafeCreatePath =
  | "/api/v1/tasks"
  | "/api/v1/activities"
  | "/api/v1/routines"
  | "/api/v1/mood";

export type RebasedActivityStatusBody = {
  editScope: "this";
  occurrenceKey: string;
  status: "pending" | "completed" | "skipped";
  completedAt: string | null;
};

export type OfflineDelivery =
  | { state: "server"; response: Response }
  | { state: "queued" }
  | { state: "unavailable" };

export interface OfflineMutationDependencies {
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  enqueue: (
    userId: string,
    mutation: QueuedMutationInput,
    options?: EnqueueMutationOptions,
  ) => Promise<QueuedMutation | null>;
  resolveUser: () => string | null;
  isOnline: () => boolean;
  uuid: () => string;
}

const replaySafeCreatePaths = new Set<string>([
  "/api/v1/tasks",
  "/api/v1/activities",
  "/api/v1/routines",
  "/api/v1/mood",
]);

const statusKeys = new Set([
  "editScope",
  "occurrenceKey",
  "status",
  "completedAt",
]);

function assertReplaySafeCreatePath(path: string): asserts path is ReplaySafeCreatePath {
  if (!replaySafeCreatePaths.has(path)) {
    throw new TypeError(`${path} is not replay-safe`);
  }
}

function assertRebasedStatusInput(
  path: string,
  body: RebasedActivityStatusBody,
): void {
  if (!/^\/api\/v1\/activities\/[^/?#]+$/.test(path)) {
    throw new TypeError(`${path} is not a replay-safe activity status path`);
  }
  const keys = Object.keys(body);
  if (
    keys.some((key) => !statusKeys.has(key)) ||
    body.editScope !== "this" ||
    typeof body.occurrenceKey !== "string" ||
    body.occurrenceKey.length === 0 ||
    !["pending", "completed", "skipped"].includes(body.status) ||
    (body.completedAt !== null && typeof body.completedAt !== "string")
  ) {
    throw new TypeError("Body is not a status-only mutation");
  }
}

function isRetryableResponse(response: Response): boolean {
  return response.status === 429 || response.status >= 500;
}

export function createOfflineMutationSender(
  dependencies: OfflineMutationDependencies,
) {
  async function queue(
    userId: string | null,
    mutation: QueuedMutationInput,
    options?: EnqueueMutationOptions,
  ): Promise<OfflineDelivery> {
    if (!userId) return { state: "unavailable" };
    const saved = await dependencies.enqueue(userId, mutation, options);
    return saved ? { state: "queued" } : { state: "unavailable" };
  }

  async function deliver(
    mutation: QueuedMutationInput,
    onlineHeaders: Record<string, string>,
    userId: string | null,
  ): Promise<OfflineDelivery> {
    if (!dependencies.isOnline()) return queue(userId, mutation);

    try {
      const response = await dependencies.fetch(mutation.path, {
        method: mutation.method,
        headers: {
          ...onlineHeaders,
          ...(userId ? { [QUEUE_OWNER_HEADER]: userId } : {}),
        },
        body: mutation.body === undefined
          ? undefined
          : JSON.stringify(mutation.body),
      });
      if (isRetryableResponse(response)) {
        return queue(userId, mutation, { deferFlushMs: 1000 });
      }
      return { state: "server", response };
    } catch {
      return queue(userId, mutation, { deferFlushMs: 1000 });
    }
  }

  return {
    async sendReplaySafeCreate(input: {
      path: ReplaySafeCreatePath;
      body: unknown;
    }): Promise<OfflineDelivery> {
      assertReplaySafeCreatePath(input.path);
      const idempotencyKey = dependencies.uuid();
      const userId = dependencies.resolveUser();
      return deliver(
        {
          method: "POST",
          path: input.path,
          body: input.body,
          idempotencyKey,
        },
        {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        userId,
      );
    },

    async sendRebasedStatusChange(input: {
      path: `/api/v1/activities/${string}`;
      body: RebasedActivityStatusBody;
      onlineRevision: number;
    }): Promise<OfflineDelivery> {
      assertRebasedStatusInput(input.path, input.body);
      const idempotencyKey = dependencies.uuid();
      const userId = dependencies.resolveUser();
      return deliver(
        {
          method: "PATCH",
          path: input.path,
          rebasePath: input.path,
          body: input.body,
          idempotencyKey,
        },
        {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
          "If-Match": String(input.onlineRevision),
        },
        userId,
      );
    },
  };
}

const defaultSender = createOfflineMutationSender({
  fetch: (input, init) => fetch(input, init),
  enqueue: enqueueMutation,
  resolveUser: () => resolveQueueUser(null),
  isOnline: () => navigator.onLine,
  uuid: () => crypto.randomUUID(),
});

export const sendReplaySafeCreate = defaultSender.sendReplaySafeCreate;
export const sendRebasedStatusChange = defaultSender.sendRebasedStatusChange;
