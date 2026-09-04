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
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { ALL_A11Y_CLASSES, A11Y_CLASS_PAIRS, A11Y_STORAGE_KEY } from "@/lib/a11y-prefs";

const css = readFileSync(resolve(__dirname, "globals.css"), "utf8");
const themeScript = readFileSync(resolve(__dirname, "theme-script-code.ts"), "utf8");
const landing = readFileSync(resolve(__dirname, "page.tsx"), "utf8");
const timeline = readFileSync(resolve(__dirname, "../components/TimelineCanvas.tsx"), "utf8");
const nowBar = readFileSync(resolve(__dirname, "../components/NowBar.tsx"), "utf8");
const oneThing = readFileSync(resolve(__dirname, "../components/OneThing.tsx"), "utf8");
const offlineIndicator = readFileSync(resolve(__dirname, "../components/OfflineIndicator.tsx"), "utf8");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".tsx") ? [readFileSync(path, "utf8")] : [];
  });
}

const componentSources = sourceFiles(resolve(__dirname, "../components"));

function cssBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  expect(block, `missing CSS block for ${selector}`).toBeTruthy();
  return block![1]!;
}

function token(block: string, name: string): string {
  const value = block.match(new RegExp(`--${name}:\\s*(#[a-f\\d]{6})`, "i"));
  expect(value, `missing --${name}`).toBeTruthy();
  return value![1]!;
}

function contrastRatio(foreground: string, background: string): number {
  const channel = (value: number) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  const luminance = (hex: string) => {
    const channels = hex.match(/[a-f\d]{2}/gi)!.map((part) =>
      channel(Number.parseInt(part, 16) / 255),
    );
    return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function saturated(hex: string, amount: number): string {
  const [red, green, blue] = hex.match(/[a-f\d]{2}/gi)!.map((part) => Number.parseInt(part, 16));
  const matrix = [
    [0.213 + 0.787 * amount, 0.715 - 0.715 * amount, 0.072 - 0.072 * amount],
    [0.213 - 0.213 * amount, 0.715 + 0.285 * amount, 0.072 - 0.072 * amount],
    [0.213 - 0.213 * amount, 0.715 - 0.715 * amount, 0.072 + 0.928 * amount],
  ];
  return `#${matrix
    .map((row) =>
      Math.round(row[0]! * red! + row[1]! * green! + row[2]! * blue!)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

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
    expect(css).toMatch(
      /\.reduced-stimulation\s+\.kairo-illo\s*\{[^}]*display:\s*none\s*!important/,
    );
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

  it("does not leave timeline state classes dimmed under high contrast", () => {
    for (const state of ["past", "done", "heavy"]) {
      const rule = css.match(new RegExp(`\\.high-contrast[^{}]*\\.timeline-${state}[^{}]*\\{[^}]*\\}`));
      expect(rule, `no high-contrast override for .timeline-${state}`).toBeTruthy();
      expect(rule![0]).toMatch(/filter:\s*none/);
      expect(rule![0]).not.toMatch(/opacity\s*:/);
    }
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

describe("normal-theme contrast contract", () => {
  const themes = [
    ["light", cssBlock(":root")],
    ["dark", cssBlock(".dark")],
  ] as const;

  it.each(themes)("keeps semantic now colors WCAG AA in %s mode", (_name, block) => {
    expect(contrastRatio(token(block, "now-text"), token(block, "surface"))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(token(block, "now-ink"), token(block, "now"))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(themes)("keeps every category ink/fill pair WCAG AA in %s mode", (_name, block) => {
    for (const category of ["peach", "butter", "mint", "sky", "lilac", "rose"]) {
      expect(
        contrastRatio(token(block, `cat-${category}-ink`), token(block, `cat-${category}`)),
        `${category} category contrast`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(themes)("keeps category pairs WCAG AA through timeline filters in %s mode", (name, block) => {
    const amounts = name === "light" ? [0.42, 0.5, 0.58] : [0.42, 0.58, 0.72];
    for (const amount of amounts) {
      for (const category of ["peach", "butter", "mint", "sky", "lilac", "rose"]) {
        expect(
          contrastRatio(
            saturated(token(block, `cat-${category}-ink`), amount),
            saturated(token(block, `cat-${category}`), amount),
          ),
          `${category} category at saturate(${amount})`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("distinguishes timeline states without reducing whole-card opacity", () => {
    for (const state of ["past", "done", "heavy"]) {
      const rule = cssBlock(`.timeline-${state}`);
      expect(rule).toMatch(/filter:\s*saturate\(/);
      expect(rule).not.toMatch(/opacity\s*:/);
    }
    expect(timeline).not.toContain("${cat.ink} opacity-");
    expect(timeline).toContain('a.done ? "timeline-done"');
    expect(timeline).toContain('heavy ? "timeline-heavy"');
  });

  it("uses semantic accessible text tokens on the landing page", () => {
    expect(landing.match(/text-now-text/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(landing).not.toContain("${cat.ink} opacity-");
    expect(landing).not.toContain('b.done ? "opacity-');
    expect(landing).toContain('b.done ? "timeline-done"');
    expect(landing).toContain("bg-surface-sunken px-3 py-2 text-[13px] text-ink-soft");
  });

  it("keeps bright now coral out of text and non-time status roles", () => {
    for (const source of componentSources) {
      expect(source).not.toMatch(/\btext-now(?=[\s"}])/);
    }
    expect(nowBar).toContain('isNow ? "text-now-text"');
    expect(oneThing).toContain('current ? "text-now-text"');
    expect(offlineIndicator).toContain("text-danger");
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
