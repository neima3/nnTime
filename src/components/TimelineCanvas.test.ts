import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./TimelineCanvas.tsx", import.meta.url),
  "utf8",
);

describe("TimelineCanvas accessibility contract", () => {
  it("keeps each activity as a labelled group so its child actions remain distinct", () => {
    expect(source).toContain('role="group"');
    expect(source).toContain('aria-roledescription="timeline activity"');
    expect(source).not.toContain('role="button"');
  });
});
