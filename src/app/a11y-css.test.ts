/**
 * Contract test for the accessibility modes (H9).
 *
 * This exists because of a real bug: `.reduced-stimulation` was toggled onto
 * <html> by Settings and checked by three components in JS, but had **zero CSS
 * rules** — so turning the mode on left every pulse, ping, spin and entrance
 * animation running. A class the app toggles must actually style something, and
 * the pre-hydration script must apply the same class names the app does.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ALL_A11Y_CLASSES, A11Y_CLASS_PAIRS, A11Y_STORAGE_KEY } from "@/lib/a11y-prefs";

const css = readFileSync(resolve(__dirname, "globals.css"), "utf8");
const themeScript = readFileSync(resolve(__dirname, "theme-script.tsx"), "utf8");

describe("accessibility mode CSS", () => {
  it("styles every class the app can toggle", () => {
    for (const cls of ALL_A11Y_CLASSES) {
      const rules = css.match(new RegExp(`\\.${cls}[^{]*\\{`, "g")) ?? [];
      expect(rules.length, `.${cls} has no CSS rules`).toBeGreaterThan(0);
    }
  });

  it("stops the decorative animations under reduced stimulation", () => {
    // The three utilities that were left running by the original bug.
    for (const util of ["animate-pulse", "animate-ping", "rise-in"]) {
      expect(css).toMatch(new RegExp(`\\.reduced-stimulation\\s+\\.${util}`));
    }
    expect(css).toMatch(/\.reduced-stimulation[\s\S]{0,400}animation:\s*none/);
  });

  it("keeps spinners moving under reduced stimulation, just slower", () => {
    // A frozen spinner reads as a hung app — calm, not broken.
    expect(css).toMatch(/\.reduced-stimulation\s+\.animate-spin\s*\{[^}]*animation-duration/);
    expect(css).not.toMatch(/\.reduced-stimulation\s+\.animate-spin\s*\{[^}]*animation:\s*none/);
  });

  it("separates high-contrast light and dark token blocks", () => {
    expect(css).toContain(".high-contrast:not(.dark)");
    expect(css).toContain(".high-contrast.dark");
  });

  it("does not leave past timeline blocks dimmed under high contrast", () => {
    // Found in the browser: .timeline-past (opacity .55 + saturate .5) was
    // applying on top of high contrast, so past titles were washed out.
    const rule = css.match(/\.high-contrast[^{]*\.timeline-past[^{]*\{[^}]*\}/);
    expect(rule, "no high-contrast override for .timeline-past").toBeTruthy();
    expect(rule![0]).toMatch(/filter:\s*none/);
    const opacity = rule![0].match(/opacity:\s*([\d.]+)/);
    expect(Number(opacity![1])).toBeGreaterThanOrEqual(0.85);
  });

  it("honours the OS contrast preference too", () => {
    expect(css).toMatch(/@media\s*\(prefers-contrast:\s*more\)/);
  });

  it("uses no pure white or pure black in the high-contrast tokens (design rule)", () => {
    const blocks = css.match(/\.high-contrast[^{]*\{[^}]*\}/g) ?? [];
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block).not.toMatch(/#fff\b|#ffffff\b/i);
      expect(block).not.toMatch(/#000\b|#000000\b/i);
    }
  });

  it("points the dyslexia font at the loaded Atkinson variable", () => {
    expect(css).toMatch(/\.dyslexia-font[\s\S]{0,300}var\(--font-atkinson\)/);
  });
});

describe("pre-hydration script", () => {
  it("reads the same storage key the app writes", () => {
    expect(themeScript).toContain("A11Y_STORAGE_KEY");
    expect(A11Y_STORAGE_KEY).toBe("kairo-a11y");
  });

  it("derives class names from the shared pairs instead of hardcoding them", () => {
    expect(themeScript).toContain("A11Y_CLASS_PAIRS");
    for (const [, cls] of A11Y_CLASS_PAIRS) {
      expect(themeScript).not.toContain(`'${cls}'`);
    }
  });
});
