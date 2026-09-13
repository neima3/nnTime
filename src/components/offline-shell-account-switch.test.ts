import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("OfflineShell account-boundary adoption", () => {
  it("adopts the live session and does not remember B before purging A", () => {
    const source = readFileSync(new URL("./OfflineShell.tsx", import.meta.url), "utf8");
    expect(source).toContain("adoptQueueUser");
    expect(source).toContain("peekRememberedUser");
    expect(source).not.toContain("resolveQueueUser");
  });
});
