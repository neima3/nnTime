import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("StatsClient brand-new account empty state", () => {
  const source = read("src/components/StatsClient.tsx");

  it("detects an account with no completions at all", () => {
    expect(source).toContain("stats.totalCompleted === 0");
  });

  it("renders the friendly empty card above the charts", () => {
    const emptyCard = source.indexOf("Nothing to reflect yet");
    const charts = source.indexOf("This week");
    expect(emptyCard).toBeGreaterThan(-1);
    expect(charts).toBeGreaterThan(emptyCard);
    // Mirrors the Today empty-state markup pattern (dashed tile + display title).
    expect(source).toContain("border border-dashed border-border bg-surface/60");
    expect(source).toContain("mt-4 font-display text-xl font-bold");
    expect(source).toContain("Finish one planned thing and this page starts to fill in.");
    // Spans both grid columns so the charts start below it.
    expect(source).toContain('className="sm:col-span-2"');
  });
});
