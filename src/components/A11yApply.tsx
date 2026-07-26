"use client";

/**
 * Applies the account's appearance + accessibility prefs on the client (H9).
 *
 * Partner to the inline script in `src/app/app/layout.tsx`. The script covers
 * the first paint of a full document load (no flash); this covers arriving at
 * /app through a client-side navigation — sign-in → Today, for example — where
 * React never executes a `dangerouslySetInnerHTML` script and the modes would
 * otherwise stay off until the next hard reload.
 *
 * Both paths are idempotent and write the same localStorage keys, so whichever
 * runs first wins and the other is a no-op.
 */
import { useEffect } from "react";
import {
  A11Y_STORAGE_KEY,
  applyA11yPrefs,
  deserializeA11yPrefs,
} from "@/lib/a11y-prefs";

export function A11yApply({
  tokens,
  theme,
  hourCycle,
}: {
  /** Serialized pref tokens — a primitive so the effect can't churn. */
  tokens: string;
  theme: "system" | "light" | "dark";
  /** Stamped onto <html> for useHourCycle(); see src/lib/time-format.ts. */
  hourCycle: "h12" | "h24";
}) {
  useEffect(() => {
    const root = document.documentElement;
    applyA11yPrefs(deserializeA11yPrefs(tokens), root.classList);
    const dark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", dark);
    root.dataset.theme = theme;
    root.dataset.hourCycle = hourCycle;
    try {
      localStorage.setItem(A11Y_STORAGE_KEY, tokens);
      localStorage.setItem("kairo-theme", theme);
    } catch {}
  }, [tokens, theme, hourCycle]);

  return null;
}
