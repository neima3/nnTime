import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("FocusClient step saves and hydrate failures", () => {
  const source = read("src/components/FocusClient.tsx");

  it("toasts when a step toggle fails to save", () => {
    const start = source.indexOf("const toggleStep = useCallback(");
    const end = source.indexOf("const markLinkedDone = useCallback(");
    const toggleStep = source.slice(start, end);
    expect(toggleStep.match(/Couldn't save that step — try again/g)).toHaveLength(2);
    expect(toggleStep).toContain('toast("Couldn\'t save that step — try again")');
  });

  it("distinguishes a failed hydrate from a signed-out hydrate", () => {
    const start = source.indexOf("const hydrate = useCallback(");
    const end = source.indexOf("useEffect(() => {\n    // Load active session after mount");
    const hydrate = source.slice(start, end);
    expect(hydrate).toContain("res.status !== 401");
    expect(hydrate).toContain("setHydrateError(true)");
    // Network throw also surfaces; stale polls never write state.
    expect(hydrate).toContain("setHydrateError(true);");
  });

  it("shows an inline error card with a Retry that re-runs the hydrate", () => {
    expect(source).toContain("const retryHydrate = useCallback(");
    expect(source).toContain("if (!session && hydrateError) {");
    expect(source).toContain('role="alert"');
    expect(source).toContain("onClick={retryHydrate}");
    expect(source).toContain("setLoading(true)");
  });

  it("starts with the paired selector and fingerprints that identity", () => {
    expect(source).toContain("focusStartBody({");
    expect(source).toContain("focusStartFingerprint(body)");
    expect(source).toContain("activitySeriesId: confirmedLink?.activitySeriesId ?? activityId");
    expect(source).toContain("occurrenceKey: confirmedLink?.occurrenceKey ?? occurrenceKey");
  });

  it("adopts server linkage on hydrate and never marks done from the timer", () => {
    expect(source).toContain("setConfirmedLink(adoptFocusLinkage(data.session))");
    expect(source).toContain("canMarkOccurrenceDone(confirmedLink)");
    const complete = source.slice(
      source.indexOf('onClick={() => void patch({ action: "transition", state: "completed" })}'),
    );
    expect(complete).not.toContain("completeLinkedOccurrence");
    expect(source).toContain("completeLinkedOccurrence({");
  });
});
