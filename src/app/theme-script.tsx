/**
 * Inline pre-hydration script — runs before first paint so nobody gets a flash
 * of the interface they opted out of.
 *
 * Applies the theme (.dark) from localStorage['kairo-theme'] and the four
 * accessibility modes from localStorage['kairo-a11y'] (written by
 * SettingsClient). The class names come from src/lib/a11y-prefs.ts so they can't
 * drift from the ones the app toggles at runtime.
 */
import { THEME_SCRIPT } from "./theme-script-code";

export { THEME_SCRIPT };

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
