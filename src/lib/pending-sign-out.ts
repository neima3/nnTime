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

/** Expire the HttpOnly session cookie via the Better Auth sign-out route. */
export async function completeServerSignOut(): Promise<void> {
  try {
    const { signOut } = await import("./auth-client");
    const result = await signOut();
    const error =
      result && typeof result === "object" && "error" in result
        ? (result as { error?: { message?: string } | null }).error
        : null;
    if (error) {
      throw new Error(error.message ?? "sign-out failed");
    }
    clearPendingSignOut();
    return;
  } catch {
    // Client helper can fail offline or on a stale chunk; the cookie-clearing
    // POST is the source of truth.
  }

  const res = await fetch("/api/auth/sign-out", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok && res.status !== 400 && res.status !== 401) {
    throw new Error(`sign-out HTTP ${res.status}`);
  }
  clearPendingSignOut();
}

export async function flushPendingSignOut(): Promise<void> {
  if (!hasPendingSignOut()) return;
  // Do not trust navigator.onLine — Playwright can restore the network
  // before the document's onLine flag and `online` event catch up.
  await completeServerSignOut();
}

export function initPendingSignOutFlush(): () => void {
  const tryFlush = () => {
    void flushPendingSignOut().catch(() => {});
  };
  window.addEventListener("online", tryFlush);
  window.addEventListener("pageshow", tryFlush);
  const interval = window.setInterval(() => {
    if (!hasPendingSignOut()) return;
    tryFlush();
  }, 400);
  tryFlush();
  return () => {
    window.removeEventListener("online", tryFlush);
    window.removeEventListener("pageshow", tryFlush);
    window.clearInterval(interval);
  };
}
