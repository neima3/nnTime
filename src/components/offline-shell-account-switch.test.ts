import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("OfflineShell account-boundary adoption", () => {
  it("adopts the live session and does not remember B before purging A", () => {
    const source = readFileSync(new URL("./OfflineShell.tsx", import.meta.url), "utf8");
    expect(source).toContain("adoptQueueUser");
    expect(source).toContain("peekRememberedUser");
    expect(source).not.toContain("resolveQueueUser");
  });

  it("clears the sign-out barrier only on a successful new auth", () => {
    const source = readFileSync(new URL("./AuthForm.tsx", import.meta.url), "utf8");
    expect(source).toContain("clearSignedOutBarrier");
  });

  it("mounts the durable sign-out flusher on every page including landing", () => {
    const source = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
    expect(source).toContain("PendingSignOutFlush");
  });

  it("asks the controlling worker to evict stale caches after register", () => {
    const source = readFileSync(
      new URL("./ServiceWorkerRegister.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("kairo:evict-foreign-caches");
  });
});
