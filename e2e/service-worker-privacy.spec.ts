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

    const registration = await navigator.serviceWorker.register(
      `/sw.js?p31=${Date.now()}`,
    );
    const ready = await navigator.serviceWorker.ready;
    const worker = ready.active ?? registration.active;
    if (worker) {
      await new Promise<void>((resolve) => {
        const finish = () => {
          navigator.serviceWorker.removeEventListener("message", onMsg);
          resolve();
        };
        const onMsg = (event: MessageEvent) => {
          if (event.data && event.data.type === "kairo:caches-evicted") {
            finish();
          }
        };
        navigator.serviceWorker.addEventListener("message", onMsg);
        worker.postMessage({ type: "kairo:evict-foreign-caches" });
        setTimeout(finish, 4_000);
      });
    }
    const deadline = Date.now() + 8_000;
    let afterActivate = await caches.keys();
    while (
      afterActivate.includes("kairo-v5-boundaries") &&
      Date.now() < deadline
    ) {
      ready.active?.postMessage({ type: "kairo:evict-foreign-caches" });
      await new Promise((resolve) => setTimeout(resolve, 50));
      afterActivate = await caches.keys();
    }
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

    return { afterActivate, cachedUrls };
  });

  expect(report.afterActivate).not.toContain("kairo-v5-boundaries");
  expect(report.afterActivate).toContain("kairo-v6-private-shell");
  expect(report.cachedUrls).not.toContain("/api/auth/get-session");
  expect(report.cachedUrls.filter((path) => path.startsWith("/app/"))).toEqual([]);
  expect(report.cachedUrls.every((path) => !path.startsWith("/api/"))).toBe(true);
});
