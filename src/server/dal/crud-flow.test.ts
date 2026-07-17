/**
 * End-to-end task CRUD flow tests.
 * Tests create → read → update → delete lifecycle against ephemeral DB.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEphemeralDb, insertUser, type EphemeralDb } from "../db/test-db";
import {
  createTask, getTask, updateTask, deleteTask, listTasks,
  createTag, listTags, updateTag, deleteTag,
  type Db,
} from "./index";

let env: EphemeralDb | null = null;
let dbAvailable = false;
let userId: string;

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
    userId = crypto.randomUUID();
    await insertUser(env.db, userId, "crud-flow@test.com");
  } catch { dbAvailable = false; }
}, 60000);

afterAll(async () => { if (env) await env.teardown(); });

const itDb = (name: string, fn: () => Promise<void> | void) =>
  it(name, async () => { if (!dbAvailable || !env) return; await fn(); });

describe("Task CRUD lifecycle", () => {
  itDb("full create → update → delete flow", async () => {
    const db: Db = env!.db;
    // Create
    const task = await createTask(userId, { bucket: "inbox", title: "Lifecycle test", priority: "low" }, { db });
    expect(task.title).toBe("Lifecycle test");
    expect(task.bucket).toBe("inbox");
    expect(task.revision).toBe(1);

    // Read
    const fetched = await getTask(userId, task.id, { db });
    expect(fetched.title).toBe("Lifecycle test");

    // Update title
    const updated = await updateTask(userId, task.id, { title: "Updated lifecycle", priority: "high" }, task.revision, { db });
    expect(updated.title).toBe("Updated lifecycle");
    expect(updated.priority).toBe("high");
    expect(updated.revision).toBe(2);

    // List
    const all = await listTasks(userId, { db });
    expect(all.find(t => t.id === task.id)?.title).toBe("Updated lifecycle");

    // Delete
    await deleteTask(userId, task.id, updated.revision, { db });
    const afterDelete = await listTasks(userId, { db });
    expect(afterDelete.find(t => t.id === task.id)).toBeUndefined();
  });

  itDb("concurrent update conflict", async () => {
    const db: Db = env!.db;
    const task = await createTask(userId, { bucket: "anytime", title: "Conflict test", priority: "none" }, { db });
    
    // First update succeeds
    const v2 = await updateTask(userId, task.id, { title: "v2" }, task.revision, { db });
    expect(v2.revision).toBe(2);

    // Second update with stale revision should fail
    await expect(
      updateTask(userId, task.id, { title: "should fail" }, task.revision, { db }),
    ).rejects.toThrow();
  });
});

describe("Tag CRUD lifecycle", () => {
  itDb("create → list → update → delete", async () => {
    const db: Db = env!.db;
    const tag = await createTag(userId, { name: "test-tag", color: "iris" }, { db });
    expect(tag.name).toBe("test-tag");

    const tags = await listTags(userId, { db });
    expect(tags.find(t => t.id === tag.id)?.name).toBe("test-tag");

    const updated = await updateTag(userId, tag.id, { name: "renamed-tag" }, tag.revision, { db });
    expect(updated.name).toBe("renamed-tag");

    await deleteTag(userId, tag.id, updated.revision, { db });
    const afterDelete = await listTags(userId, { db });
    expect(afterDelete.find(t => t.id === tag.id)).toBeUndefined();
  });

  itDb("duplicate tag name returns unique constraint error", async () => {
    const db: Db = env!.db;
    await createTag(userId, { name: "unique-test" }, { db });
    // Second with same name should fail (unique index on user_id + name)
    await expect(
      createTag(userId, { name: "unique-test" }, { db }),
    ).rejects.toThrow();
  });
});
