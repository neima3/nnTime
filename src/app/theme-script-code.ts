/**
 * Constant first-paint theme/a11y script body — no React, so tests can import
 * the exact text that ThemeScript renders.
 *
 * Interpolates only compile-time constants from a11y-prefs.ts (storage key +
 * pref→class pairs). Per-request values never enter this string.
 */
import { A11Y_CLASS_PAIRS, A11Y_STORAGE_KEY } from "@/lib/a11y-prefs";

export const THEME_SCRIPT = `
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
