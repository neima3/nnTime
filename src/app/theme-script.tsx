/**
 * Inline pre-hydration script — runs before first paint so nobody gets a flash
 * of the interface they opted out of.
 *
 * Applies the theme (.dark) from localStorage['kairo-theme'] and the four
 * accessibility modes from localStorage['kairo-a11y'] (written by
 * SettingsClient). The class names come from src/lib/a11y-prefs.ts so they can't
 * drift from the ones the app toggles at runtime.
 */
import { A11Y_CLASS_PAIRS, A11Y_STORAGE_KEY } from "@/lib/a11y-prefs";

export function ThemeScript() {
  const code = `
    (function() {
      try {
        var t = localStorage.getItem('kairo-theme') || 'system';
        var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (dark) document.documentElement.classList.add('dark');
        document.documentElement.dataset.theme = t;
      } catch(e) {}
      try {
        var on = (localStorage.getItem(${JSON.stringify(A11Y_STORAGE_KEY)}) || '').split(',');
        var pairs = ${JSON.stringify(A11Y_CLASS_PAIRS)};
        for (var i = 0; i < pairs.length; i++) {
          if (on.indexOf(pairs[i][0]) !== -1) {
            document.documentElement.classList.add(pairs[i][1]);
          }
        }
      } catch(e) {}
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
