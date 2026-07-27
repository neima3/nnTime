"use client";

/**
 * Offline mutation queue — ADR-002 (Phase 6B).
 *
 * Queue of mutations with idempotency keys, replayed in order on reconnect.
 * 429/5xx retry with exponential backoff; 4xx terminal → conflict UI.
 * Caches are user-scoped (IndexedDB key prefix = user id), never store auth
 * responses, and are purged on logout/account switch.
 *
 * Usage:
 *   import { enqueueMutation, flushQueue, purgeUserCache } from "@/lib/offline-queue";
 *   // On mutation: enqueueMutation(userId, { method, path, body })
 *   // On reconnect: flushQueue(userId)
 *   // On logout: purgeUserCache(userId)
 */

const DB_NAME = "kairo-offline";
const STORE = "mutations";
const DB_VERSION = 1;

/** Open the IndexedDB database (user-scoped via key prefix). */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Last signed-in user id, remembered so an offline mutation can still be keyed
 * correctly when the session hook hasn't resolved yet.
 *
 * `useSession()` resolves asynchronously, and offline is exactly when it may not
 * resolve at all — without this, a capture made in the first moments after load
 * (or on a cold offline start) had no user to file itself under and was refused.
 * Only the id is stored; it is not a credential and the queue is per-origin.
 */
const LAST_USER_KEY = "kairo-last-user";

export function rememberUser(userId: string): void {
  try {
    localStorage.setItem(LAST_USER_KEY, userId);
  } catch {}
}

/** The session's user id if known, else the last one seen on this device. */
export function resolveQueueUser(userId: string | null | undefined): string | null {
  if (userId) {
    rememberUser(userId);
    return userId;
  }
  try {
    return localStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
}

export interface QueuedMutation {
  id?: number;
  userId: string;
  method: "POST" | "PATCH" | "DELETE" | "PUT";
  path: string;
  body?: unknown;
  idempotencyKey: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
  status: "pending" | "terminal";
  /**
   * Rebase-on-replay (ADR-002): GET this path at flush time and use the
   * fresh `revision` as If-Match, instead of a revision pinned at enqueue
   * time (stale by replay). Only status-only mutations may opt in — they
   * touch no other fields, so replaying against any revision is safe.
   * A 404 on the re-read means the item was deleted while offline → terminal.
   */
  rebasePath?: string;
}

/**
 * Enqueue a mutation. If online, it's flushed immediately. If offline, it
 * stays in the queue until reconnect.
 */
export async function enqueueMutation(
  userId: string,
  mutation: Omit<QueuedMutation, "id" | "userId" | "createdAt" | "attempts" | "status">,
): Promise<QueuedMutation | null> {
  const entry: QueuedMutation = {
    ...mutation,
    userId,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: "pending",
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).add(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // IndexedDB unavailable — return null (caller falls back to direct fetch).
    return null;
  }

  // If online, flush immediately.
  if (navigator.onLine) {
    flushQueue(userId);
  }

  return entry;
}

/**
 * Flush all pending mutations for a user, in order. Retries 429/5xx with
 * exponential backoff; 4xx (except 429) marks terminal.
 */
export async function flushQueue(userId: string): Promise<void> {
  let mutations: QueuedMutation[] = [];
  try {
    const db = await openDB();
    mutations = await new Promise<QueuedMutation[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as QueuedMutation[]);
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch {
    return;
  }

  // Filter to this user's pending mutations, sorted by creation order.
  const pending = mutations
    .filter((m) => m.userId === userId && m.status === "pending")
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

  let flushed = 0;
  for (const mut of pending) {
    const result = await executeMutation(mut);
    if (result.terminal) {
      // 4xx — mark terminal, surface conflict UI.
      await updateMutation(mut.id!, { status: "terminal", lastError: result.error });
      // Emit a custom event the UI can listen for.
      window.dispatchEvent(
        new CustomEvent("kairo:conflict", {
          detail: { mutation: mut, error: result.error },
        }),
      );
    } else if (!result.success) {
      // 429/5xx — increment attempts, will retry on next flush.
      const backoff = Math.min(1000 * Math.pow(2, mut.attempts), 30000);
      await updateMutation(mut.id!, {
        attempts: mut.attempts + 1,
        lastError: result.error,
      });
      // Schedule a retry.
      setTimeout(() => flushQueue(userId), backoff);
      break; // Stop processing — retry from the top after backoff.
    } else {
      // Success — remove from queue.
      await removeMutation(mut.id!);
      flushed++;
    }
  }

  // Something landed on the server — let mounted pages re-read truth
  // (Today re-renders replayed completions, the inbox shows captures).
  if (flushed > 0) {
    window.dispatchEvent(
      new CustomEvent("kairo:queue-drained", { detail: { flushed } }),
    );
  }
}

/** Execute a single mutation via fetch. Exported for tests only. */
export async function executeMutation(
  mut: QueuedMutation,
): Promise<{ success: boolean; terminal: boolean; error?: string }> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Idempotency-Key": mut.idempotencyKey,
    };

    // Rebase-on-replay: re-read the resource for a fresh If-Match revision.
    if (mut.rebasePath) {
      const readRes = await fetch(mut.rebasePath);
      if (readRes.status === 404 || readRes.status === 410) {
        return {
          success: false,
          terminal: true,
          error: "This item was deleted while you were offline",
        };
      }
      if (readRes.status === 429 || readRes.status >= 500) {
        return { success: false, terminal: false, error: `HTTP ${readRes.status} on re-read` };
      }
      if (!readRes.ok) {
        return { success: false, terminal: true, error: `HTTP ${readRes.status} on re-read` };
      }
      const current = (await readRes.json().catch(() => null)) as
        | { revision?: number }
        | null;
      if (current?.revision == null) {
        return { success: false, terminal: true, error: "Couldn't read the current version" };
      }
      headers["If-Match"] = String(current.revision);
    }

    const res = await fetch(mut.path, {
      method: mut.method,
      headers,
      body: mut.body ? JSON.stringify(mut.body) : undefined,
    });

    if (res.ok) return { success: true, terminal: false };
    // Under rebase a 409 means a write landed between our re-read and the
    // replay — the next flush re-reads again, so retry rather than give up.
    if (res.status === 429 || res.status >= 500 || (res.status === 409 && mut.rebasePath)) {
      const body = await res.json().catch(() => ({}));
      return { success: false, terminal: false, error: body?.error?.message ?? `HTTP ${res.status}` };
    }
    // 4xx (except 429) — terminal.
    const body = await res.json().catch(() => ({}));
    return { success: false, terminal: true, error: body?.error?.message ?? `HTTP ${res.status}` };
  } catch (e) {
    // Network error — not terminal, will retry.
    return { success: false, terminal: false, error: e instanceof Error ? e.message : "network error" };
  }
}

/** Update a mutation in the queue. */
async function updateMutation(id: number, updates: Partial<QueuedMutation>): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.get(id);
    req.onsuccess = () => {
      const existing = req.result as QueuedMutation;
      if (existing) {
        store.put({ ...existing, ...updates });
      }
    };
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    db.close();
  } catch {
    // Ignore — best effort.
  }
}

/** Remove a mutation from the queue (on success). */
async function removeMutation(id: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    db.close();
  } catch {
    // Ignore.
  }
}

/**
 * Purge all cached data for a user (on logout/account switch).
 * ADR-002: caches are user-scoped and purged on logout.
 */
export async function purgeUserCache(userId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    // Delete all mutations for this user.
    const all = await new Promise<QueuedMutation[]>((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as QueuedMutation[]);
    });
    for (const m of all) {
      if (m.userId === userId) {
        store.delete(m.id!);
      }
    }
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    db.close();
  } catch {
    // Ignore — best effort.
  }

  // Also clear any sessionStorage/localStorage keys prefixed with the user id.
  const prefix = `kairo:${userId}:`;
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
  }
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) localStorage.removeItem(key);
  }
}

/**
 * Get the count of pending mutations (for UI badge / status indicator).
 */
export async function getPendingCount(userId: string): Promise<number> {
  try {
    const db = await openDB();
    const all = await new Promise<QueuedMutation[]>((resolve) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as QueuedMutation[]);
    });
    db.close();
    return all.filter((m) => m.userId === userId && m.status === "pending").length;
  } catch {
    return 0;
  }
}

/**
 * Initialize the offline queue: listen for online/offline events.
 * Call once on app mount.
 */
export function initOfflineQueue(userId: string): () => void {
  const onOnline = () => flushQueue(userId);
  window.addEventListener("online", onOnline);

  // If we start online, flush any pending.
  if (navigator.onLine) {
    flushQueue(userId);
  }

  return () => {
    window.removeEventListener("online", onOnline);
  };
}
