import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("SettingsClient error handling and control names", () => {
  const source = read("src/components/SettingsClient.tsx");

  it("wraps patch in try/catch that reports through the status line", () => {
    const patchStart = source.indexOf("async (partial: Partial<Settings>) => {");
    const patchEnd = source.indexOf("const patchA11y = useCallback(");
    const patch = source.slice(patchStart, patchEnd);
    expect(patch).toContain("try {");
    expect(patch).toContain('setStatus("Couldn\'t reach the server — try again?")');
    expect(patch).toContain("} catch {");
    // Success copy unchanged.
    expect(patch).toContain('setStatus("Saved")');
  });

  it("wraps exportData in try/catch that reports through the status line", () => {
    const start = source.indexOf("const exportData = useCallback(");
    const end = source.indexOf("const [deleteConfirm, setDeleteConfirm]");
    const exportData = source.slice(start, end);
    expect(exportData).toContain("try {");
    expect(exportData).toContain('setStatus("Couldn\'t reach the server — try again?")');
    expect(exportData).toContain("} catch {");
    expect(exportData).toContain('setStatus("Export downloaded")');
  });

  it("wraps deleteAccount in try/catch and clears the busy flag in finally", () => {
    const start = source.indexOf("const deleteAccount = useCallback(");
    const end = source.indexOf("const linkGoogle = useCallback(");
    const deleteAccount = source.slice(start, end);
    expect(deleteAccount).toContain("try {");
    expect(deleteAccount).toContain('setStatus("Couldn\'t reach the server — try again?")');
    expect(deleteAccount).toContain("} finally {");
    expect(deleteAccount).toContain("setDeleteBusy(false);");
  });

  it("names the theme, hour-cycle and week-start selects", () => {
    expect(source).toContain('aria-label="Theme"');
    expect(source).toContain('aria-label="Hour cycle"');
    expect(source).toContain('aria-label="Week starts"');
  });

  it("names the ICS URL input instead of relying on the placeholder", () => {
    expect(source).toContain('aria-label="ICS calendar URL"');
  });
});
