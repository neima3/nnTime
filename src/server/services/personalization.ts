/**
 * Personalization service — Phase 5B.
 *
 * Theme toggle (.dark persistence), reduced-stimulation mode, dedicated
 * high-contrast mode (strengthened ink/border tokens, WCAG AAA targets; honors
 * prefers-contrast and iOS Increase Contrast), dyslexia-friendly font
 * (Atkinson Hyperlegible), larger text, first-day-of-week, 12/24h, per-category
 * color/label editing within token constraints.
 */
import "server-only";
import { getOrCreateSettings, type Db } from "../dal";

export interface PersonalizationState {
  theme: "system" | "light" | "dark";
  reducedStimulation: boolean;
  highContrast: boolean;
  dyslexiaFont: boolean;
  largerText: boolean;
  weekStart: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  hourCycle: "h12" | "h24";
}

/**
 * Get the user's personalization state from settings. High-contrast and
 * dyslexia font are derived from notificationPrefs JSON (presentation extras).
 */
export async function getPersonalization(
  userId: string,
  opts: { db?: Db } = {},
): Promise<PersonalizationState> {
  const settings = await getOrCreateSettings(userId, opts);
  const prefs = (settings.notificationPrefs ?? {}) as {
    highContrast?: boolean;
    dyslexiaFont?: boolean;
    largerText?: boolean;
  };
  return {
    theme: settings.theme,
    reducedStimulation: settings.reducedStimulation,
    highContrast: prefs.highContrast ?? false,
    dyslexiaFont: prefs.dyslexiaFont ?? false,
    largerText: prefs.largerText ?? false,
    weekStart: settings.weekStart as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    hourCycle: settings.hourCycle,
  };
}
