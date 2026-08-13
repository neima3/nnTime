/**
 * Compact-density contract for the two places Kairo squeezes an activity into
 * a few dozen pixels: the Today timeline block and the Week grid chip.
 *
 * Both used to solve overflow with `truncate`, which silently ate the facts the
 * block exists to show — every phone-width block lost its duration ("8:00 AM –
 * 8:45 A…") and every seven-column chip lost its title ("Mor…"). The rule now
 * is: shorten the rendering, never ellipse the primary fact.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const timeline = readFileSync(new URL("./TimelineCanvas.tsx", import.meta.url), "utf8");
const week = readFileSync(
  new URL("../app/app/week/page.tsx", import.meta.url),
  "utf8",
);

describe("timeline block meta line", () => {
  it("wraps its segments instead of ellipsing the duration away", () => {
    expect(timeline).toContain("flex flex-wrap items-baseline");
    // The old single truncated line.
    expect(timeline).not.toMatch(/tnum mt-0\.5 truncate/);
  });

  it("keeps the time range and the duration whole when they reflow", () => {
    expect(timeline.match(/className="whitespace-nowrap"/g)?.length ?? 0).toBeGreaterThan(2);
  });

  it("renders a narrow-width form beside the full one", () => {
    expect(timeline).toContain("function compactRange");
    expect(timeline).toContain("function compactDuration");
    expect(timeline).toContain('<span className="sm:hidden" aria-hidden>');
    expect(timeline).toContain('<span className="hidden sm:inline">');
  });

  it("hides the narrow duplicate from assistive tech so the time is announced once", () => {
    const compactVariants = timeline.match(/className="sm:hidden"[^>]*/g) ?? [];
    expect(compactVariants.length).toBeGreaterThan(0);
    for (const variant of compactVariants) expect(variant).toContain("aria-hidden");
  });

  it("gives the shortest blocks one row rather than a stack that spills out", () => {
    expect(timeline).toContain("const micro = h < MICRO_PX");
    expect(timeline).toContain("const compact = h < COMPACT_PX");
  });

  it("keeps block height a pure function of duration", () => {
    // Density tiers may change type and padding; they must never change height.
    expect(timeline).toContain("const h = a.duration * PX_PER_MIN;");
    expect(timeline).toContain("height: h,");
  });
});

describe("week grid chip", () => {
  it("gives the title the chip's full width instead of the leftovers", () => {
    expect(week).toContain("mt-0.5 block truncate text-[12.5px]");
    expect(week).not.toMatch(/flex items-center gap-2 rounded-xl/);
  });

  it("sheds the meridiem, then the emoji, rather than clipping the clock", () => {
    expect(week).toContain('className="hidden max-md:inline xl:inline"');
    expect(week).toContain("max-lg:inline xl:inline");
  });
});
