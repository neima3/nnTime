/**
 * Pure-logic unit tests for ClientErrorReporter's error normalization. This
 * repo has no jsdom/DOM-testing setup (vitest runs with `environment: "node"`
 * — see vitest.config.ts and the a11y-prefs.test.ts precedent for the same
 * constraint), so the DOM-facing half of the component (window listeners,
 * fetch, dedupe/cap wiring) is covered by lint+typecheck plus manual/E2E
 * verification instead of a render test. `describeError` is the part with
 * real branching logic and is exported specifically so it can be pinned here
 * without a DOM.
 */
import { describe, expect, it } from "vitest";
import { describeError } from "./ClientErrorReporter";

describe("describeError", () => {
  it("extracts name/message/stack from a real Error", () => {
    const err = new TypeError("Cannot read properties of undefined");
    const out = describeError(err);
    expect(out.name).toBe("TypeError");
    expect(out.message).toBe("Cannot read properties of undefined");
    expect(out.stack).toContain("TypeError");
  });

  it("falls back to 'Error' for an Error subclass with no name set", () => {
    class Weird extends Error {
      override name = "";
    }
    const out = describeError(new Weird("boom"));
    expect(out.name).toBe("Error");
  });

  it("handles a plain string rejection reason", () => {
    const out = describeError("promise rejected with a string");
    expect(out).toEqual({ name: "Error", message: "promise rejected with a string" });
  });

  it("handles a plain object rejection reason by JSON-stringifying it", () => {
    const out = describeError({ code: "ECONNRESET", detail: "socket hang up" });
    expect(out.name).toBe("Error");
    expect(out.message).toBe(JSON.stringify({ code: "ECONNRESET", detail: "socket hang up" }));
  });

  it("never throws on a cyclic rejection reason", () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(() => describeError(cyclic)).not.toThrow();
    const out = describeError(cyclic);
    expect(out.name).toBe("Error");
    expect(out.message).toBe("Non-serializable rejection reason");
  });

  it("handles undefined/null rejection reasons without throwing", () => {
    expect(describeError(undefined).message).toBe("undefined");
    expect(describeError(null).message).toBe("null");
  });
});
