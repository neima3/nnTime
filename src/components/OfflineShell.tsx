"use client";

import { useSession } from "@/lib/auth-client";
import { resolveQueueUser } from "@/lib/offline-queue";
import { OfflineIndicator } from "./OfflineIndicator";

/**
 * Mounts the offline queue for the signed-in user (AppShell footer).
 *
 * Falls back to the device's remembered user when the session hook has no
 * data — offline is exactly when `useSession()` may fail or never resolve,
 * and a null here silently killed the offline banner AND the reconnect
 * flush (found by the offline E2E spec). Sign-out forgets the remembered
 * user, so the fallback can't outlive the account.
 */
export function OfflineShell() {
  const { data } = useSession();
  const userId = resolveQueueUser(data?.user?.id ?? null);
  return <OfflineIndicator userId={userId} />;
}
