/**
 * Hash-friendly /app prefs bootstrap (CSP Stage 1).
 *
 * The SCRIPT TEXT is a compile-time constant — per-user values travel as
 * data-* attributes on the <script> element, never interpolated into the
 * body, so a CSP sha256 hash can allow-list it.
 */
import { createHash } from "node:crypto";
import {
  a11yClassList,
  ALL_A11Y_CLASSES,
  A11Y_STORAGE_KEY,
  serializeA11yPrefs,
  type A11yPrefs,
} from "@/lib/a11y-prefs";

export const PREFS_BOOTSTRAP_SCRIPT = `
(function(){
  try {
    var s = document.currentScript || document.querySelector('script[data-kairo-prefs]');
    if (!s) return;
    var el = document.documentElement;
    el.classList.remove(${ALL_A11Y_CLASSES.map((c) => JSON.stringify(c)).join(",")});
    var on = (s.dataset.a11yClasses || '').split(/\\s+/);
    for (var i = 0; i < on.length; i++) if (on[i]) el.classList.add(on[i]);
    var t = s.dataset.theme || 'system';
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    el.classList.toggle('dark', dark);
    el.dataset.theme = t;
    el.dataset.hourCycle = s.dataset.hourCycle || 'h24';
    localStorage.setItem('kairo-theme', t);
    localStorage.setItem(${JSON.stringify(A11Y_STORAGE_KEY)}, s.dataset.a11y || '');
  } catch(e) {}
})();
`.trim();

export function prefsBootstrapAttributes(
  prefs: A11yPrefs,
  theme: "system" | "light" | "dark",
  hourCycle: "h12" | "h24",
): {
  "data-kairo-prefs": string;
  "data-theme": string;
  "data-hour-cycle": string;
  "data-a11y": string;
  "data-a11y-classes": string;
} {
  return {
    "data-kairo-prefs": "1",
    "data-theme": theme,
    "data-hour-cycle": hourCycle,
    "data-a11y": serializeA11yPrefs(prefs),
    "data-a11y-classes": a11yClassList(prefs).join(" "),
  };
}

/** CSP source expression `sha256-<base64>` of the exact UTF-8 script bytes. */
export function scriptHash(text: string): string {
  return `sha256-${createHash("sha256").update(text, "utf8").digest("base64")}`;
}
