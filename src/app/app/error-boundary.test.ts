import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("/app error boundary", () => {
  const path = "src/app/app/error.tsx";

  it("exists under /app so product routes don't fall to the root boundary", () => {
    expect(existsSync(path)).toBe(true);
  });

  it("is a client component receiving the error-boundary props", () => {
    const source = readFileSync(path, "utf8");
    expect(source).toContain('"use client"');
    expect(source).toContain("error: Error & { digest?: string }");
    expect(source).toContain("reset: () => void");
  });

  it("renders the Kairo card with its own heading and a Try again control", () => {
    const source = readFileSync(path, "utf8");
    expect(source).toContain("This screen slipped.");
    expect(source).toContain("Try again");
    expect(source).toContain("onClick={reset}");
    expect(source).toContain('href="/app/today"');
  });
});
