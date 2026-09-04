"use client";

/**
 * Offline indicator + queue initializer — Phase 6B.
 *
 * Mounts in the AppShell. Shows a small "Offline — N changes queued" banner
 * when the network is down. Initializes the offline mutation queue on mount.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CloudOff, X } from "lucide-react";
import { Illustration } from "./Illustration";
import {
  dismissTerminalMutations,
  getQueueSummary,
  initOfflineQueue,
  rememberUser,
} from "@/lib/offline-queue";

export function OfflineIndicator({ userId }: { userId: string | null }) {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [terminal, setTerminal] = useState(0);

  useEffect(() => {
    const syncConnectivity = () => setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    syncConnectivity();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    // Remember who this is, so an offline capture before the session hook
    // resolves can still key its queue entry correctly.
    rememberUser(userId);
    const cleanup = initOfflineQueue(userId);

    const updateStatus = async () => {
      const summary = await getQueueSummary(userId);
      setPending(summary.pending);
      setTerminal(summary.terminal);
    };
    const onQueueChanged = () => void updateStatus();
    const onQueueDrained = () => {
      void updateStatus();
      router.refresh();
    };

    void updateStatus();
    window.addEventListener("kairo:queue-changed", onQueueChanged);
    window.addEventListener("kairo:queue-drained", onQueueDrained);
    window.addEventListener("kairo:conflict", onQueueChanged);

    const interval = setInterval(onQueueChanged, 5000);

    return () => {
      cleanup();
      window.removeEventListener("kairo:queue-changed", onQueueChanged);
      window.removeEventListener("kairo:queue-drained", onQueueDrained);
      window.removeEventListener("kairo:conflict", onQueueChanged);
      clearInterval(interval);
    };
  }, [router, userId]);

  if (online && pending === 0 && terminal === 0) return null;

  return (
    <div
      role={terminal > 0 ? "alert" : "status"}
      className="fixed bottom-52 left-1/2 z-30 w-[min(92vw,34rem)] -translate-x-1/2 rounded-2xl border border-border bg-surface-raised px-4 py-3 shadow-float md:bottom-24"
    >
      <div className="flex items-start gap-2.5 text-[13px] font-semibold">
        {terminal > 0 ? (
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-danger" />
        ) : !online ? (
          <>
            <Illustration name="offline-cloud" size={44} glow="none" className="-my-2 -ml-1" />
            <CloudOff size={17} className="mt-0.5 hidden shrink-0 text-danger [.reduced-stimulation_&]:block" />
          </>
        ) : (
          <CloudOff size={17} className="mt-0.5 shrink-0 text-iris" />
        )}
        <div className="min-w-0 flex-1">
          {terminal > 0 ? (
            <>
              <p>A saved offline change couldn’t sync. Kairo kept the server version.</p>
              {pending > 0 && (
                <p className="mt-0.5 text-ink-soft">
                  {pending} other change{pending === 1 ? "" : "s"} still queued
                </p>
              )}
            </>
          ) : (
            <p>
              {!online && <>You&apos;re offline</>}
              {!online && pending > 0 && " · "}
              {pending > 0 &&
                `${pending} change${pending === 1 ? "" : "s"} queued`}
            </p>
          )}
        </div>
        {terminal > 0 && userId && (
          <button
            type="button"
            aria-label="Dismiss offline conflict"
            onClick={() => {
              void dismissTerminalMutations(userId);
            }}
            className="-my-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-xl text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none md:-my-1.5 md:-mr-1.5 md:size-10"
          >
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
