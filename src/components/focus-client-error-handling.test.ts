import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("FocusClient step saves and hydrate failures", () => {
  const source = read("src/components/FocusClient.tsx");

  it("toasts when a step toggle fails to save", () => {
    const start = source.indexOf("const toggleStep = useCallback(");
    const end = source.indexOf("const hydrateGenRef = useRef(0);");
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
});
