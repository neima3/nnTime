"use client";

/**
 * Registers the PWA service worker once on the client.
 */
import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "development") return; // avoid SW cache fighting HMR
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (registration) => {
        await navigator.serviceWorker.ready;
        registration.active?.postMessage({
          type: "kairo:evict-foreign-caches",
        });
      })
      .catch(() => {
        /* non-fatal */
      });
  }, []);
  return null;
}
