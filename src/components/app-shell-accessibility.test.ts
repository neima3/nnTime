import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("AppShell accessibility", () => {
  it("uses a WCAG-readable token for the desktop shortcut legend", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/AppShell.tsx"),
      "utf8",
    );

    expect(source).toContain(
      'bg-surface-sunken p-3 text-[11px] text-ink-soft',
    );
    expect(source).not.toContain(
      'bg-surface-sunken p-3 text-[11px] text-ink-faint',
    );
  });
});
