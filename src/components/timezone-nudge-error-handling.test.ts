import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("TimezoneNudge apply failure feedback", () => {
  const source = read("src/components/TimezoneNudge.tsx");

  it("imports the shared toast helper", () => {
    expect(source).toContain('import { toast } from "./Toast";');
  });

  it("toasts a clear message on failure and keeps the banner visible", () => {
    const start = source.indexOf("const apply = async () => {");
    const end = source.indexOf("const cityLabel =");
    const apply = source.slice(start, end);
    expect(apply).toContain("try {");
    expect(apply).toContain(
      'toast("Couldn\'t change the timezone — try again?")',
    );
    // A null settings read is a failure, not a silent no-op.
    expect(apply.indexOf("toast(")).toBeLessThan(apply.indexOf("const res = await fetch("));
    // The catch no longer swallows: it toasts.
    expect(apply).toContain("} catch {");
    // Failure paths never hide the banner.
    expect(apply.match(/setHidden\(true\)/g)).toHaveLength(1);
  });

  it("handles 409 by re-reading settings and saying so", () => {
    const start = source.indexOf("const apply = async () => {");
    const end = source.indexOf("const cityLabel =");
    const apply = source.slice(start, end);
    expect(apply).toContain("res.status === 409");
    expect(apply).toContain("invalidateSettingsCache();");
    expect(apply).toContain("changed elsewhere");
  });
});
