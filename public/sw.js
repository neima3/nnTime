/**
 * Kairo service worker — Phase 6B (PWA).
 *
 * Responsibilities:
 *  - Cache the app shell for offline use (ADR-002 offline protocol: user-scoped
 *    caches, purge on logout/account switch).
 *  - Never cache auth responses.
 *  - Network-first for navigation, stale-while-revalidate for static assets.
 *  - Web Push handlers (Phase 3B notification delivery).
 *
 * This is a minimal SW; the full ADR-002 offline mutation queue lands with 6B's
 * complete enablement.
 */
const CACHE_VERSION = "kairo-v4-push";
const APP_SHELL = ["/", "/app/today", "/manifest.json", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // API/auth data: always network-first, never served from the SW cache.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }

  // Network-first for navigation requests (fresh HTML).
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then((r) => r || caches.match("/"))),
    );
    return;
  }

  // Stale-while-revalidate for static assets.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response.ok) {
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, response.clone()));
        }
        return response;
      });
      return cached || fetchPromise;
    }),
  );
});

// Web Push handler (Phase 3B / F1).
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Kairo", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/app/today" },
    }),
  );
});

// Focus (or open) the app when a notification is tapped.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/app/today";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          w.navigate(url).catch(() => {});
          return w.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
