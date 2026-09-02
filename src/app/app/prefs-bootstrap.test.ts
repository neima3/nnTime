import { describe, expect, it } from "vitest";
import {
  a11yClassList,
  serializeA11yPrefs,
  type A11yPrefs,
} from "@/lib/a11y-prefs";
import { THEME_SCRIPT } from "../theme-script-code";
import {
  PREFS_BOOTSTRAP_SCRIPT,
  prefsBootstrapAttributes,
  scriptHash,
} from "./prefs-bootstrap";

const HASH_RE = /^sha256-[A-Za-z0-9+/]+=*$/;

const prefsOn: A11yPrefs = {
  reducedStimulation: true,
  highContrast: false,
  dyslexiaFont: true,
  largerText: false,
};

const prefsOff: A11yPrefs = {
  reducedStimulation: false,
  highContrast: true,
  dyslexiaFont: false,
  largerText: true,
};

describe("PREFS_BOOTSTRAP_SCRIPT", () => {
  it("is a constant; varying prefs live on data attributes", () => {
    const a = prefsBootstrapAttributes(prefsOn, "dark", "h12");
    const b = prefsBootstrapAttributes(prefsOff, "light", "h24");

    expect(a).not.toEqual(b);
    expect(a["data-kairo-prefs"]).toBe("1");
    expect(a["data-theme"]).toBe("dark");
    expect(a["data-hour-cycle"]).toBe("h12");
    expect(a["data-a11y"]).toBe(serializeA11yPrefs(prefsOn));
    expect(a["data-a11y-classes"]).toBe(a11yClassList(prefsOn).join(" "));
    expect(b["data-theme"]).toBe("light");
    expect(b["data-hour-cycle"]).toBe("h24");
    expect(b["data-a11y"]).toBe(serializeA11yPrefs(prefsOff));
    expect(PREFS_BOOTSTRAP_SCRIPT).not.toContain(a["data-a11y"]);
    expect(PREFS_BOOTSTRAP_SCRIPT).not.toContain(b["data-a11y"]);
  });

  it("applies dataset prefs against a minimal fake DOM", () => {
    const classes = new Set<string>();
    const dataset: Record<string, string> = {};
    const classList = {
      add(...tokens: string[]) {
        for (const t of tokens) if (t) classes.add(t);
      },
      remove(...tokens: string[]) {
        for (const t of tokens) classes.delete(t);
      },
      toggle(token: string, force?: boolean) {
        const on = force === undefined ? !classes.has(token) : force;
        if (on) classes.add(token);
        else classes.delete(token);
        return on;
      },
      contains(token: string) {
        return classes.has(token);
      },
    };
    const attrs = prefsBootstrapAttributes(prefsOn, "dark", "h12");
    const currentScript = {
      dataset: {
        kairoPrefs: attrs["data-kairo-prefs"],
        theme: attrs["data-theme"],
        hourCycle: attrs["data-hour-cycle"],
        a11y: attrs["data-a11y"],
        a11yClasses: attrs["data-a11y-classes"],
      },
    };
    const document = {
      documentElement: { classList, dataset },
      currentScript,
      querySelector: (sel: string) =>
        sel === "script[data-kairo-prefs]" ? currentScript : null,
    };
    const window = {
      matchMedia: () => ({ matches: false }),
    };
    const store = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
    };

    const apply = new Function(
      "document",
      "window",
      "localStorage",
      PREFS_BOOTSTRAP_SCRIPT,
    );
    apply(document, window, localStorage);

    expect([...classes].sort()).toEqual(
      ["dark", ...a11yClassList(prefsOn)].sort(),
    );
    expect(dataset.theme).toBe("dark");
    expect(dataset.hourCycle).toBe("h12");
    expect(store.get("kairo-theme")).toBe("dark");
    expect(store.get("kairo-a11y")).toBe(serializeA11yPrefs(prefsOn));
  });

  it("pins CSP hashes for the constant first-party scripts", () => {
    expect(scriptHash(PREFS_BOOTSTRAP_SCRIPT)).toMatch(HASH_RE);
    expect(scriptHash(THEME_SCRIPT)).toMatch(HASH_RE);
    expect(scriptHash(PREFS_BOOTSTRAP_SCRIPT)).toMatchInlineSnapshot(`"sha256-Vvq43+94iz78pMshjXPxaIvX3moghmUAuOtBgzqj/8c="`);
    expect(scriptHash(THEME_SCRIPT)).toMatchInlineSnapshot(`"sha256-gkNQpFekbJSFtU+sNAoVz/HVKLmpbWNQoqDlw4PcwFI="`);
  });
});
