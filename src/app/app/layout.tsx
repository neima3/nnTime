/**
 * Product-area layout (H9).
 *
 * Applies the signed-in user's appearance + accessibility prefs on the server.
 * Without this, the only thing that ever set those classes was SettingsClient
 * plus the localStorage fast path — so signing in on a **new device or browser**
 * showed the default interface until you happened to open Settings, even though
 * the prefs were stored server-side and syncing to iOS.
 *
 * Scoped to /app on purpose: the marketing routes stay static (no per-request
 * session), while every product route gets the right surfaces from first paint.
 */
import { A11yApply } from "@/components/A11yApply";
import { AppSessionProvider } from "@/components/AppSessionBoundary";
import { HourCycleProvider } from "@/lib/use-hour-cycle";
import { getSession } from "@/server/auth-session";
import { getPersonalization } from "@/server/services/personalization";
import {
  a11yClassList,
  ALL_A11Y_CLASSES,
  A11Y_DEFAULTS,
  A11Y_STORAGE_KEY,
  serializeA11yPrefs,
  type A11yPrefs,
} from "@/lib/a11y-prefs";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let prefs: A11yPrefs = { ...A11Y_DEFAULTS };
  let theme: "system" | "light" | "dark" = "system";
  let hourCycle: "h12" | "h24" = "h24";
  let known = false;

  const session = await getSession();
  if (session?.userId) {
    try {
      const p = await getPersonalization(session.userId);
      theme = p.theme;
      hourCycle = p.hourCycle === "h12" ? "h12" : "h24";
      prefs = {
        reducedStimulation: p.reducedStimulation,
        highContrast: p.highContrast,
        dyslexiaFont: p.dyslexiaFont,
        largerText: p.largerText,
      };
      known = true;
    } catch {
      // Settings unavailable (DB hiccup) — render the default surfaces rather
      // than failing the page. The client reconciles on the next settings read.
    }
  }

  // Signed out (or settings unreadable) means we have no account preference to
  // apply — and writing defaults here would clobber the local choice the root
  // ThemeScript just restored. Do nothing instead.
  if (!known) {
    return (
      <AppSessionProvider signedIn={Boolean(session?.userId)}>
        <HourCycleProvider value="h24">{children}</HourCycleProvider>
      </AppSessionProvider>
    );
  }

  // Reconcile <html> against the server's truth before the app paints. Runs
  // after the root ThemeScript (localStorage fast path), so a stored account
  // preference wins on a device that has never seen it. The storage key gets the
  // pref *tokens* (what ThemeScript parses), not the class names.
  const code = `
    (function(){
      try {
        var el = document.documentElement;
        el.classList.remove(${ALL_A11Y_CLASSES.map((c) => JSON.stringify(c)).join(",")});
        var on = ${JSON.stringify(a11yClassList(prefs))};
        for (var i = 0; i < on.length; i++) el.classList.add(on[i]);
        var t = ${JSON.stringify(theme)};
        var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        el.classList.toggle('dark', dark);
        el.dataset.theme = t;
        el.dataset.hourCycle = ${JSON.stringify(hourCycle)};
        localStorage.setItem('kairo-theme', t);
        localStorage.setItem(${JSON.stringify(A11Y_STORAGE_KEY)}, ${JSON.stringify(
          serializeA11yPrefs(prefs),
        )});
      } catch(e) {}
    })();
  `;

  return (
    <AppSessionProvider signedIn={Boolean(session?.userId)}>
      {/* Script = no-flash first paint on a document load; A11yApply = the same
          result when /app is reached by client-side navigation, where React
          never runs an inline script. */}
      <script dangerouslySetInnerHTML={{ __html: code }} />
      <A11yApply tokens={serializeA11yPrefs(prefs)} theme={theme} hourCycle={hourCycle} />
      <HourCycleProvider value={hourCycle}>{children}</HourCycleProvider>
    </AppSessionProvider>
  );
}
