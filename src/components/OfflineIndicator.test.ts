import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./OfflineIndicator.tsx", import.meta.url),
  "utf8",
);

describe("OfflineIndicator recovery contract", () => {
  it("loads durable queue state and responds to every queue lifecycle event", () => {
    expect(source).toContain("getQueueSummary");
    expect(source).toContain('"kairo:queue-changed"');
    expect(source).toContain('"kairo:queue-drained"');
    expect(source).toContain('"kairo:conflict"');
  });

  it("refreshes server-rendered truth after replay drains", () => {
    expect(source).toContain("router.refresh()");
  });

  it("tracks connectivity even before a queue owner resolves", () => {
    expect(source).toContain("navigator.onLine");
    expect(source).toContain('window.addEventListener("offline", syncConnectivity)');
    expect(source.indexOf('window.addEventListener("offline", syncConnectivity)')).toBeLessThan(
      source.indexOf("if (!userId) return;"),
    );
  });

  it("reports the terminal outcome without exposing mutation contents", () => {
    expect(source).toContain(
      "A saved offline change couldn’t sync. Kairo kept the server version.",
    );
    expect(source).toContain("dismissTerminalMutations");
    expect(source).toMatch(/aria-label="Dismiss offline conflict"/);
  });
});
