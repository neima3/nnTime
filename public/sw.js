/**
 * Kairo service worker — Phase 6B (PWA).
 *
 * Responsibilities:
 *  - Cache only the public shell; account data stays in ADR-002's user-scoped
 *    IndexedDB stores and is purged on logout/account switch.
 *  - Never cache auth responses.
 *  - Network-first for navigation, cache-first for explicit public assets.
 *  - Web Push handlers (Phase 3B notification delivery).
 */
const CACHE_VERSION = "kairo-v6-private-shell";
const APP_SHELL = ["/", "/manifest.json", "/icon-192.png"];
const PUBLIC_ASSET_PATHS = new Set(["/manifest.json", "/icon-192.png"]);

function isCacheablePublicAsset(request, url) {
  return (
    request.method === "GET" &&
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      PUBLIC_ASSET_PATHS.has(url.pathname))
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
      ),
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

  // Navigation can contain account data or reset tokens. Honor server no-store
  // headers and use only the public landing page as an offline fallback.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).catch(() =>
        caches.match("/", { cacheName: CACHE_VERSION }),
      ),
    );
    return;
  }

  // Route payloads, auth resources, and cross-origin requests bypass Cache
  // Storage. Only same-origin public assets with immutable build URLs are kept.
  if (!isCacheablePublicAsset(event.request, url)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE_VERSION);
          await cache.put(event.request, response.clone());
        }
        return response;
      });
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
      silent: data.silent === true,
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
