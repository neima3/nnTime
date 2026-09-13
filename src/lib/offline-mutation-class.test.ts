import { describe, expect, it } from "vitest";
import {
  assertQueueableMutation,
  classifyOfflineMutation,
  isStatusOnlyBody,
} from "./offline-mutation-class";

const statusBody = {
  editScope: "this" as const,
  occurrenceKey: "2026-09-14T14:00:00.000Z",
  status: "completed" as const,
  completedAt: "2026-09-14T15:00:00.000Z",
};

describe("ADR-002 offline mutation classification", () => {
  it.each([
    ["/api/v1/tasks", { bucket: "inbox", title: "Milk" }],
    ["/api/v1/activities", { title: "Walk" }],
    ["/api/v1/routines", { title: "Morning" }],
    ["/api/v1/mood", { mood: "good" }],
  ] as const)("queues replay-safe POST %s", (path, body) => {
    expect(
      classifyOfflineMutation({ method: "POST", path, body }),
    ).toBe("replay-safe-create");
    expect(() =>
      assertQueueableMutation({ method: "POST", path, body }),
    ).not.toThrow();
  });

  it("queues a rebase-on-replay status-only activity PATCH", () => {
    expect(
      classifyOfflineMutation({
        method: "PATCH",
        path: "/api/v1/activities/act-1",
        rebasePath: "/api/v1/activities/act-1",
        body: statusBody,
      }),
    ).toBe("rebase-status");
  });

  it.each([
    {
      name: "general title edit",
      input: {
        method: "PATCH",
        path: "/api/v1/activities/act-1",
        body: { editScope: "this", occurrenceKey: "k", title: "Clobber" },
      },
    },
    {
      name: "status PATCH without rebase marker",
      input: {
        method: "PATCH",
        path: "/api/v1/activities/act-1",
        body: statusBody,
      },
    },
    {
      name: "checklist override",
      input: {
        method: "PATCH",
        path: "/api/v1/activities/act-1",
        rebasePath: "/api/v1/activities/act-1",
        body: { ...statusBody, checklistOverride: [{ label: "x", done: true }] },
      },
    },
    {
      name: "inbox delete",
      input: {
        method: "DELETE",
        path: "/api/v1/tasks/task-1",
      },
    },
    {
      name: "activity delete",
      input: {
        method: "DELETE",
        path: "/api/v1/activities/act-1",
      },
    },
    {
      name: "focus start (ADR-004 must not broaden replay)",
      input: {
        method: "POST",
        path: "/api/v1/focus-sessions",
        body: { title: "Deep work", durationMin: 25 },
      },
    },
    {
      name: "focus transition",
      input: {
        method: "PATCH",
        path: "/api/v1/focus-sessions/sess-1",
        body: { state: "paused" },
      },
    },
    {
      name: "task schedule conversion",
      input: {
        method: "POST",
        path: "/api/v1/tasks/task-1/schedule",
        body: { title: "Block" },
      },
    },
  ])("refuses to queue $name", ({ input }) => {
    expect(classifyOfflineMutation(input)).toBe("never-queued");
    expect(() => assertQueueableMutation(input)).toThrow(/not queueable offline/);
  });

  it("rejects a status body that hides a title clobber", () => {
    expect(isStatusOnlyBody({ ...statusBody, title: "Nope" })).toBe(false);
  });
});
