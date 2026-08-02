import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type WorkerEvent = {
  request?: { method: string; mode: string; url: string };
  respondWith?: (response: Promise<Response> | Response) => void;
  waitUntil?: (work: Promise<unknown>) => void;
};

function serviceWorkerHarness() {
  const listeners = new Map<string, (event: WorkerEvent) => void>();
  const cachePuts: string[] = [];
  const cacheDeletes: string[] = [];
  const installEntries: string[][] = [];
  const fetchMock = vi.fn(async () =>
    new Response("route payload with synthetic secret", {
      status: 200,
      headers: { "cache-control": "private, no-store" },
    }),
  );
  const cache = {
    addAll: vi.fn(async (entries: string[]) => {
      installEntries.push([...entries]);
    }),
    delete: vi.fn(async () => true),
    match: vi.fn(async () => undefined),
    put: vi.fn(async (request: { url: string }) => {
      cachePuts.push(request.url);
    }),
  };
  const cachesMock = {
    delete: vi.fn(async (name: string) => {
      cacheDeletes.push(name);
      return true;
    }),
    keys: vi.fn(async () => [
      "kairo-v6-private-shell",
      "kairo-v5-boundaries",
      "kairo-v4-push",
    ]),
    match: vi.fn(async () => undefined),
    open: vi.fn(async () => cache),
  };
  const clients = {
    claim: vi.fn(async () => undefined),
    matchAll: vi.fn(async () => []),
    openWindow: vi.fn(async () => undefined),
  };
  const self = {
    addEventListener: vi.fn(
      (type: string, listener: (event: WorkerEvent) => void) => {
        listeners.set(type, listener);
      },
    ),
    clients,
    location: { origin: "https://time.neima.me" },
    registration: { showNotification: vi.fn(async () => undefined) },
    skipWaiting: vi.fn(),
  };

  runInNewContext(
    readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8"),
    {
      Response,
      URL,
      caches: cachesMock,
      clients,
      fetch: fetchMock,
      self,
    },
  );

  async function dispatchLifecycle(type: "install" | "activate") {
    let work: Promise<unknown> = Promise.resolve();
    listeners.get(type)?.({
      waitUntil(value) {
        work = Promise.resolve(value);
      },
    });
    await work;
  }

  async function dispatchFetch(request: WorkerEvent["request"]) {
    let response: Promise<Response> | undefined;
    const respondWith = vi.fn((value: Promise<Response> | Response) => {
      response = Promise.resolve(value);
    });
    listeners.get("fetch")?.({ request, respondWith });
    if (response) await response;
    await new Promise((resolveTick) => setImmediate(resolveTick));
    return { respondWith };
  }

  return {
    cacheDeletes,
    cachePuts,
    dispatchFetch,
    dispatchLifecycle,
    fetchMock,
    installEntries,
  };
}

describe("service-worker cache privacy", () => {
  it("preloads only public shell assets and evicts every prior cache", async () => {
    const worker = serviceWorkerHarness();

    await worker.dispatchLifecycle("install");
    await worker.dispatchLifecycle("activate");

    expect(worker.installEntries).toEqual([
      ["/", "/manifest.json", "/icon-192.png"],
    ]);
    expect(worker.cacheDeletes).toEqual([
      "kairo-v5-boundaries",
      "kairo-v4-push",
    ]);
  });

  it("never stores navigation HTML or Next route payloads", async () => {
    const worker = serviceWorkerHarness();

    const navigation = await worker.dispatchFetch({
      method: "GET",
      mode: "navigate",
      url: "https://time.neima.me/reset-password?token=synthetic-secret",
    });
    const routePayload = await worker.dispatchFetch({
      method: "GET",
      mode: "cors",
      url: "https://time.neima.me/app/today?_rsc=account-payload",
    });

    expect(navigation.respondWith).toHaveBeenCalledOnce();
    expect(routePayload.respondWith).not.toHaveBeenCalled();
    expect(worker.cachePuts).toEqual([]);
  });

  it("caches only allowlisted immutable static assets", async () => {
    const worker = serviceWorkerHarness();

    const staticAsset = await worker.dispatchFetch({
      method: "GET",
      mode: "cors",
      url: "https://time.neima.me/_next/static/chunks/app.js",
    });
    const crossOrigin = await worker.dispatchFetch({
      method: "GET",
      mode: "cors",
      url: "https://cdn.example.invalid/public.js",
    });

    expect(staticAsset.respondWith).toHaveBeenCalledOnce();
    expect(crossOrigin.respondWith).not.toHaveBeenCalled();
    expect(worker.cachePuts).toEqual([
      "https://time.neima.me/_next/static/chunks/app.js",
    ]);
  });

  it("keeps API requests network-only with the browser cache disabled", async () => {
    const worker = serviceWorkerHarness();

    await worker.dispatchFetch({
      method: "POST",
      mode: "cors",
      url: "https://time.neima.me/api/auth/reset-password",
    });

    expect(worker.fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://time.neima.me/api/auth/reset-password",
      }),
      { cache: "no-store" },
    );
    expect(worker.cachePuts).toEqual([]);
  });
});
