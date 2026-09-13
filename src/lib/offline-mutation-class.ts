/**
 * ADR-002 offline mutation classes (decided 2026-07-26).
 *
 * A queued mutation may replay minutes-to-days later. Safety depends on what
 * the mutation can clobber:
 *   1. Replay-safe creates — plain POSTs with an Idempotency-Key.
 *   2. Rebase-on-replay status changes — complete / uncomplete / skip only.
 *   3. Never queued — general edits, checklist overrides, deletes, focus.
 *
 * ADR-004's older "offline transition queued per ADR-002" wording is not
 * permission to broaden replay. Focus stays server-authoritative.
 */

export type OfflineMutationClass =
  | "replay-safe-create"
  | "rebase-status"
  | "never-queued";

const replaySafeCreatePaths = new Set([
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

export function isReplaySafeCreatePath(path: string): boolean {
  return replaySafeCreatePaths.has(path);
}

export function isStatusOnlyBody(body: unknown): boolean {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return false;
  }
  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length === 0 || keys.some((key) => !statusKeys.has(key))) {
    return false;
  }
  return (
    record.editScope === "this" &&
    typeof record.occurrenceKey === "string" &&
    record.occurrenceKey.length > 0 &&
    (record.status === "pending" ||
      record.status === "completed" ||
      record.status === "skipped") &&
    (record.completedAt === null || typeof record.completedAt === "string")
  );
}

export function classifyOfflineMutation(input: {
  method: string;
  path: string;
  body?: unknown;
  rebasePath?: string;
}): OfflineMutationClass {
  if (input.method === "POST" && replaySafeCreatePaths.has(input.path)) {
    return "replay-safe-create";
  }
  if (
    input.method === "PATCH" &&
    /^\/api\/v1\/activities\/[^/?#]+$/.test(input.path) &&
    input.rebasePath === input.path &&
    isStatusOnlyBody(input.body)
  ) {
    return "rebase-status";
  }
  return "never-queued";
}

export function assertQueueableMutation(input: {
  method: string;
  path: string;
  body?: unknown;
  rebasePath?: string;
}): void {
  if (classifyOfflineMutation(input) === "never-queued") {
    throw new TypeError(
      "Mutation is not queueable offline under ADR-002 classification",
    );
  }
}
