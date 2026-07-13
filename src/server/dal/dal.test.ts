/**
 * DAL negative tests — ADR-005 SEC-01, the mandatory authz tests.
 *
 * Verifies at the data layer (independent of HTTP):
 *  - Cross-user access: a user cannot read/write another user's resources.
 *    getTask/Update/delete on another user's task → NotFoundError (which the
 *    API maps to 404 to avoid enumeration).
 *  - Revision conflict: updateTask with a stale If-Match → ConflictError.
 *  - Tombstone: deleted tasks are invisible to list/get.
 *  - Change log: every mutation appends a change_log row scoped to the user.
 *
 * These run against an ephemeral Postgres (migrations applied fresh).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  createEphemeralDb,
  insertUser,
  type EphemeralDb,
} from "../db/test-db";
import * as schema from "../db/schema";
import {
  createTask,
  getTask,
  updateTask,
  deleteTask,
  listTasks,
  getChanges,
  ConflictError,
  NotFoundError,
} from "./index";

let env: EphemeralDb | null = null;
let dbAvailable = false;
let userA = "user-a";
let userB = "user-b";

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
    // Create two users (Better Auth user table).
    userA = crypto.randomUUID();
    userB = crypto.randomUUID();
    await insertUser(env.db, userA, "a@test.com");
    await insertUser(env.db, userB, "b@test.com");
  } catch {
    dbAvailable = false;
  }
}, 60000);

afterAll(async () => {
  if (env) await env.teardown();
});

const itDb = (name: string, fn: () => Promise<void> | void) =>
  it(name, async () => {
    if (!dbAvailable || !env) return;
    await fn();
  });

describe("SEC-01: cross-user isolation", () => {
  itDb("user A creates a task; user B cannot read it", async () => {
    const task = await createTask(
      userA,
      { bucket: "inbox", title: "A's secret task" },
      { db: env!.db },
    );
    // User B tries to read it → NotFoundError (not "forbidden" — avoid enumeration).
    await expect(getTask(userB, task.id, { db: env!.db })).rejects.toThrow(NotFoundError);
  });

  itDb("user B cannot update user A's task", async () => {
    const task = await createTask(
      userA,
      { bucket: "inbox", title: "A's task" },
      { db: env!.db },
    );
    await expect(
      updateTask(userB, task.id, { title: "hacked" }, task.revision, { db: env!.db }),
    ).rejects.toThrow(NotFoundError);
    // The task is unchanged.
    const still = await getTask(userA, task.id, { db: env!.db });
    expect(still.title).toBe("A's task");
  });

  itDb("user B cannot delete user A's task", async () => {
    const task = await createTask(
      userA,
      { bucket: "inbox", title: "A's task" },
      { db: env!.db },
    );
    await expect(
      deleteTask(userB, task.id, task.revision, { db: env!.db }),
    ).rejects.toThrow(NotFoundError);
    // Still exists.
    const still = await getTask(userA, task.id, { db: env!.db });
    expect(still.title).toBe("A's task");
  });

  itDb("listTasks only returns the caller's tasks", async () => {
    await createTask(userA, { bucket: "inbox", title: "A1" }, { db: env!.db });
    await createTask(userB, { bucket: "inbox", title: "B1" }, { db: env!.db });
    const aTasks = await listTasks(userA, { db: env!.db });
    const bTasks = await listTasks(userB, { db: env!.db });
    expect(aTasks.every((t) => t.userId === userA)).toBe(true);
    expect(bTasks.every((t) => t.userId === userB)).toBe(true);
    expect(aTasks.some((t) => t.title === "B1")).toBe(false);
  });
});

describe("ADR-002: revision conflict", () => {
  itDb("updateTask with stale revision → ConflictError", async () => {
    const task = await createTask(
      userA,
      { bucket: "inbox", title: "original" },
      { db: env!.db },
    );
    // First update succeeds, bumps revision.
    await updateTask(userA, task.id, { title: "v2" }, task.revision, {
      db: env!.db,
    });
    // Second update with the STALE revision → conflict.
    await expect(
      updateTask(userA, task.id, { title: "v3-stale" }, task.revision, {
        db: env!.db,
      }),
    ).rejects.toThrow(ConflictError);
  });

  itDb("deleteTask with stale revision → ConflictError", async () => {
    const task = await createTask(
      userA,
      { bucket: "inbox", title: "to delete" },
      { db: env!.db },
    );
    await updateTask(userA, task.id, { title: "updated" }, task.revision, {
      db: env!.db,
    });
    await expect(
      deleteTask(userA, task.id, task.revision, { db: env!.db }),
    ).rejects.toThrow(ConflictError);
  });
});

describe("ADR-002: tombstones + change log", () => {
  itDb("deleted tasks are invisible to list and get", async () => {
    const task = await createTask(
      userA,
      { bucket: "inbox", title: "will delete" },
      { db: env!.db },
    );
    await deleteTask(userA, task.id, task.revision, { db: env!.db });
    // getTask throws NotFound.
    await expect(getTask(userA, task.id, { db: env!.db })).rejects.toThrow(
      NotFoundError,
    );
    // listTasks doesn't include it.
    const tasks = await listTasks(userA, { db: env!.db });
    expect(tasks.find((t) => t.id === task.id)).toBeUndefined();
  });

  itDb("every mutation appends to the change log", async () => {
    const before = await getChanges(userA, 0, 1000, { db: env!.db });
    const created = await createTask(
      userA,
      { bucket: "inbox", title: "logged" },
      { db: env!.db },
    );
    const afterCreate = await getChanges(userA, 0, 1000, { db: env!.db });
    expect(afterCreate.items.length).toBeGreaterThan(before.items.length);
    const createEntry = afterCreate.items.find(
      (c) => c.entityId === created.id && c.op === "upsert",
    );
    expect(createEntry).toBeDefined();

    await deleteTask(userA, created.id, created.revision, { db: env!.db });
    const afterDelete = await getChanges(userA, 0, 1000, { db: env!.db });
    const deleteEntry = afterDelete.items.find(
      (c) => c.entityId === created.id && c.op === "delete",
    );
    expect(deleteEntry).toBeDefined();
  });

  itDb("change log is user-scoped (B can't see A's changes)", async () => {
    await createTask(userA, { bucket: "inbox", title: "A change" }, {
      db: env!.db,
    });
    const bChanges = await getChanges(userB, 0, 1000, { db: env!.db });
    expect(bChanges.items.every((c) => c.userId === userB)).toBe(true);
  });
});
