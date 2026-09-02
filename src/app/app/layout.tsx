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
import { headers } from "next/headers";
import { A11yApply } from "@/components/A11yApply";
import { AppSessionProvider } from "@/components/AppSessionBoundary";
import { HourCycleProvider } from "@/lib/use-hour-cycle";
import { getSession } from "@/server/auth-session";
import { getPersonalization } from "@/server/services/personalization";
import {
  A11Y_DEFAULTS,
  serializeA11yPrefs,
  type A11yPrefs,
} from "@/lib/a11y-prefs";
import {
  PREFS_BOOTSTRAP_SCRIPT,
  prefsBootstrapAttributes,
} from "./prefs-bootstrap";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let prefs: A11yPrefs = { ...A11Y_DEFAULTS };
  let theme: "system" | "light" | "dark" = "system";
  let hourCycle: "h12" | "h24" = "h24";
  let known = false;

  const session = await getSession();
  // getSession already read headers (dynamic). Re-read to skip the bootstrap
  // <script> on RSC/prefetch navigations — inline scripts never run in a
  // client-rendered tree, so omitting them drops the React "Encountered a
  // script tag" warning without losing first-paint behavior.
  const h = await headers();
  const skipPrefsScript =
    h.get("rsc") === "1" || h.get("next-router-prefetch") === "1";

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

  const signedIn = Boolean(session?.userId);
  const user = session?.user ?? null;

  // Signed out (or settings unreadable) means we have no account preference to
  // apply — and writing defaults here would clobber the local choice the root
  // ThemeScript just restored. Do nothing instead.
  if (!known) {
    return (
      <AppSessionProvider signedIn={signedIn} user={user}>
        <HourCycleProvider value="h24">{children}</HourCycleProvider>
      </AppSessionProvider>
    );
  }

  // Reconcile <html> against the server's truth before the app paints. Runs
  // after the root ThemeScript (localStorage fast path), so a stored account
  // preference wins on a device that has never seen it. Per-user values live
  // on data-* attributes; the script body is a constant (CSP-hashable).
  const attrs = prefsBootstrapAttributes(prefs, theme, hourCycle);

  return (
    <AppSessionProvider signedIn={signedIn} user={user}>
      {/* Script = no-flash first paint on a document load; A11yApply = the same
          result when /app is reached by client-side navigation, where React
          never runs an inline script. */}
      {skipPrefsScript ? null : (
        <script
          {...attrs}
          dangerouslySetInnerHTML={{ __html: PREFS_BOOTSTRAP_SCRIPT }}
        />
      )}
      <A11yApply tokens={serializeA11yPrefs(prefs)} theme={theme} hourCycle={hourCycle} />
      <HourCycleProvider value={hourCycle}>{children}</HourCycleProvider>
    </AppSessionProvider>
  );
}
