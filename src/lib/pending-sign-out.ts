/**
 * Durable sign-out that survives the offline → reconnect gap.
 *
 * Better Auth sessions are HttpOnly cookies. A rejected `signOut()` while
 * offline must not leave that cookie usable after the UI already shows
 * Sign in — full-page fallback navigation wipes in-memory listeners.
 * sessionStorage outlives that navigation; the root flusher retries.
 */

const PENDING_KEY = "kairo-pending-sign-out";

export function markPendingSignOut(): void {
  try {
    sessionStorage.setItem(PENDING_KEY, "1");
  } catch {
    // Private mode — best effort.
  }
}

export function hasPendingSignOut(): boolean {
  try {
    return sessionStorage.getItem(PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearPendingSignOut(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Ignore.
  }
}

/** POST /api/auth/sign-out so the server can expire the HttpOnly cookie. */
export async function completeServerSignOut(): Promise<void> {
  const res = await fetch("/api/auth/sign-out", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok && res.status !== 400 && res.status !== 401) {
    throw new Error(`sign-out HTTP ${res.status}`);
  }
  clearPendingSignOut();
}

export async function flushPendingSignOut(): Promise<void> {
  if (!hasPendingSignOut()) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  await completeServerSignOut();
}

export function initPendingSignOutFlush(): () => void {
  const onOnline = () => {
    void flushPendingSignOut().catch(() => {});
  };
  window.addEventListener("online", onOnline);
  void flushPendingSignOut().catch(() => {});
  return () => window.removeEventListener("online", onOnline);
}
