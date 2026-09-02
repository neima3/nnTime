import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("WeeklyIntentions load and save failure handling", () => {
  const source = read("src/components/WeeklyIntentions.tsx");

  it("surfaces GET failures instead of staying invisible forever", () => {
    expect(source).toContain("setLoadFailed(true)");
    // Both the non-ok path and the network throw end in the same feedback.
    expect(source.match(/setLoadFailed\(true\)/g)?.length).toBeGreaterThanOrEqual(2);
    // 401 keeps the signed-out behaviour (no error card for signed-out users).
    expect(source).toContain("signedOut = true");
  });

  it("offers an inline retry that re-runs the loader", () => {
    expect(source).toContain("onClick={retryLoad}");
    expect(source).toContain("setRetryKey((k) => k + 1)");
    expect(source).toContain("[weekStart, retryKey]");
  });

  it("toasts on PATCH failure and keeps the local text", () => {
    expect(source).toContain(
      'toast("Couldn\'t save it just now — kept on this device")',
    );
    // Both !res.ok and the catch toast; neither reverts the user's text.
    expect(source.match(/Couldn't save it just now — kept on this device/g))
      .toHaveLength(2);
    expect(source).not.toContain("setItems(prefs)");
  });
});
