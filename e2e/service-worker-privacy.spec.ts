/**
 * P3.1 — real service-worker cache privacy (not the vm harness).
 *
 * Dev skips auto-registration; this spec registers /sw.js itself so both
 * `pnpm dev` and the standalone CI server exercise Cache Storage.
 */
import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

test.use({
  locale: "en-US",
  timezoneId: "America/New_York",
  serviceWorkers: "allow",
});

test.setTimeout(60_000);

test("upgrade evicts prior sensitive caches and never stores auth or private HTML", async ({
  page,
}) => {
  await gotoHydrated(page, "/app/today");

  const report = await page.evaluate(async () => {
    for (const registration of await navigator.serviceWorker.getRegistrations()) {
      await registration.unregister();
    }
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));

    // Seed, then drop the Cache handle. Chromium can keep a name in
    // caches.keys() while any page still holds the Cache object.
    await (async () => {
      const stale = await caches.open("kairo-v5-boundaries");
      await stale.put(
        "/app/today",
        new Response("<html>prior private shell</html>", {
          headers: { "content-type": "text/html" },
        }),
      );
      await stale.put(
        "/api/auth/get-session",
        new Response(JSON.stringify({ user: { id: "leaked" } }), {
          headers: { "content-type": "application/json" },
        }),
      );
    })();

    // Canonical URL matches production. A query-string bypass can leave
    // the already-active /sw.js controlling without a new activate.
    await navigator.serviceWorker.register("/sw.js");
    const ready = await navigator.serviceWorker.ready;

    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          reject(new Error("service worker did not claim the page"));
        }, 8_000);
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => {
            window.clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
        if (navigator.serviceWorker.controller) {
          window.clearTimeout(timer);
          resolve();
        }
      });
    }

    const worker = navigator.serviceWorker.controller ?? ready.active;
    if (!worker) {
      throw new Error("no controlling service worker after ready");
    }

    const channel = new MessageChannel();
    const purgeAck = await new Promise<{ type?: string; keys?: string[] }>(
      (resolve, reject) => {
        const timer = window.setTimeout(() => {
          reject(new Error("PURGE_FOREIGN_CACHES was not acknowledged"));
        }, 8_000);
        channel.port1.onmessage = (event) => {
          window.clearTimeout(timer);
          resolve(
            (event.data ?? {}) as { type?: string; keys?: string[] },
          );
        };
        worker.postMessage({ type: "PURGE_FOREIGN_CACHES" }, [channel.port2]);
      },
    );

    const afterActivate = await caches.keys();
    const staleStillOpen =
      typeof caches.has === "function"
        ? await caches.has("kairo-v5-boundaries")
        : afterActivate.includes("kairo-v5-boundaries");

    await fetch("/api/auth/get-session", { cache: "reload" });
    await fetch("/app/today", {
      cache: "reload",
      headers: { accept: "text/html" },
    });

    const cachedUrls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        cachedUrls.push(new URL(request.url).pathname);
      }
    }

    return {
      afterActivate,
      staleStillOpen,
      cachedUrls,
      purgeAck,
    };
  });

  expect(report.purgeAck.type).toBe("PURGE_FOREIGN_CACHES_DONE");
  expect(report.purgeAck.keys ?? []).not.toContain("kairo-v5-boundaries");
  expect(report.purgeAck.keys ?? []).toContain("kairo-v6-private-shell");
  expect(report.staleStillOpen).toBe(false);
  expect(report.afterActivate).not.toContain("kairo-v5-boundaries");
  expect(report.afterActivate).toContain("kairo-v6-private-shell");
  expect(report.cachedUrls).not.toContain("/api/auth/get-session");
  expect(report.cachedUrls.filter((path) => path.startsWith("/app/"))).toEqual([]);
  expect(report.cachedUrls.every((path) => !path.startsWith("/api/"))).toBe(true);
});
