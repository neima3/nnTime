"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { adoptQueueUser, peekRememberedUser } from "@/lib/offline-queue";
import { OfflineIndicator } from "./OfflineIndicator";

/**
 * Mounts the offline queue for the signed-in user (AppShell footer).
 *
 * Falls back to the device's remembered user when the session hook has no
 * data — offline is exactly when `useSession()` may fail or never resolve,
 * and a null here silently killed the offline banner AND the reconnect
 * flush (found by the offline E2E spec). Sign-out forgets the remembered
 * user, so the fallback can't outlive the account. A live A→B switch
 * purges A's queue before B's indicator mounts.
 */
export function OfflineShell() {
  const { data } = useSession();
  const [userId, setUserId] = useState<string | null>(() =>
    data?.user?.id ?? peekRememberedUser(),
  );

  useEffect(() => {
    void adoptQueueUser(data?.user?.id ?? null).then(setUserId);
  }, [data?.user?.id]);

  return <OfflineIndicator userId={userId} />;
}
