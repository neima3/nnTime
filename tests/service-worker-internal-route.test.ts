import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type WorkerListener = (event: {
  request?: { mode: string; url: string };
  respondWith?: (response: Promise<Response>) => void;
  waitUntil?: (work: Promise<unknown>) => void;
}) => void;

function loadWorker() {
  const listeners = new Map<string, WorkerListener>();
  const currentCache = {
    addAll: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(true),
    put: vi.fn().mockResolvedValue(undefined),
  };
  const caches = {
    delete: vi.fn().mockResolvedValue(true),
    keys: vi.fn().mockResolvedValue(["kairo-v4-push", "kairo-v5-boundaries"]),
    match: vi.fn().mockResolvedValue(new Response("offline shell")),
    open: vi.fn().mockResolvedValue(currentCache),
  };
  const fetch = vi.fn().mockResolvedValue(new Response("network"));
  const self = {
    addEventListener: (type: string, listener: WorkerListener) => {
      listeners.set(type, listener);
    },
    clients: { claim: vi.fn(), matchAll: vi.fn() },
    registration: { showNotification: vi.fn() },
    skipWaiting: vi.fn(),
  };

  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    URL,
    caches,
    clients: self.clients,
    fetch,
    self,
  });

  return { caches, currentCache, fetch, listeners };
}

describe("service worker internal route boundary", () => {
  it("purges the old navigation cache and the internal route on activation", async () => {
    const { caches, currentCache, listeners } = loadWorker();
    let activation: Promise<unknown> | undefined;

    listeners.get("activate")?.({
      waitUntil: (work) => {
        activation = work;
      },
    });
    await activation;

    expect(caches.delete).toHaveBeenCalledWith("kairo-v4-push");
    expect(currentCache.delete).toHaveBeenCalledWith("/app/timeline-states");
  });

  it("never stores the internal route as an offline navigation", async () => {
    const { currentCache, listeners } = loadWorker();
    let response: Promise<Response> | undefined;

    listeners.get("fetch")?.({
      request: {
        mode: "navigate",
        url: "https://time.neima.me/app/timeline-states",
      },
      respondWith: (work) => {
        response = work;
      },
    });
    await response;
    await Promise.resolve();

    expect(currentCache.put).not.toHaveBeenCalled();
  });
});
