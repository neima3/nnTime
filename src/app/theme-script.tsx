/**
 * Inline theme script — runs before hydration to prevent dark mode FOUC.
 * Reads localStorage['kairo-theme'] and sets .dark on <html>.
 */
export function ThemeScript() {
  const code = `
    (function() {
      try {
        var t = localStorage.getItem('kairo-theme') || 'system';
        var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (dark) document.documentElement.classList.add('dark');
        document.documentElement.dataset.theme = t;
      } catch(e) {}
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
