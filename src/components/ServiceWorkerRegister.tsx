"use client";

/**
 * Registers the PWA service worker once on the client.
 */
import { useEffect } from "react";

function requestForeignCachePurge(worker: ServiceWorker) {
  const channel = new MessageChannel();
  worker.postMessage({ type: "PURGE_FOREIGN_CACHES" }, [channel.port2]);
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "development") return; // avoid SW cache fighting HMR
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (registration) => {
        await navigator.serviceWorker.ready;
        const worker =
          navigator.serviceWorker.controller ?? registration.active;
        if (worker) requestForeignCachePurge(worker);
      })
      .catch(() => {
        /* non-fatal */
      });
  }, []);
  return null;
}
