"use client";

/**
 * Offline indicator + queue initializer — Phase 6B.
 *
 * Mounts in the AppShell. Shows a small "Offline — N changes queued" banner
 * when the network is down. Initializes the offline mutation queue on mount.
 */

import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";
import { initOfflineQueue, getPendingCount } from "@/lib/offline-queue";

export function OfflineIndicator({ userId }: { userId: string | null }) {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const cleanup = initOfflineQueue(userId);

    const updateStatus = () => {
      setOnline(navigator.onLine);
      getPendingCount(userId).then(setPending);
    };

    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    // Poll pending count every 5s while offline.
    const interval = setInterval(updateStatus, 5000);

    return () => {
      cleanup();
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
      clearInterval(interval);
    };
  }, [userId]);

  if (online && pending === 0) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-xl bg-surface-raised px-4 py-2 shadow-float md:bottom-4">
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        <CloudOff size={16} className={online ? "text-iris" : "text-now"} />
        {!online && <span>You&apos;re offline</span>}
        {pending > 0 && (
          <span className="text-ink-soft">
            {pending} change{pending === 1 ? "" : "s"} queued
          </span>
        )}
      </div>
    </div>
  );
}
