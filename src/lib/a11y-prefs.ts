/**
 * Accessibility presentation prefs (H9) — the single mapping from stored
 * settings to the classes on <html>.
 *
 * `reducedStimulation` is a real settings column; high contrast, dyslexia font
 * and larger text live in `notificationPrefs` (presentation extras, same shape
 * the personalization service reads). All four are also mirrored to
 * localStorage so the pre-hydration script can apply them on first paint —
 * without that, someone who needs calm surfaces gets a flash of the animated
 * ones on every page load.
 *
 * Pure module: the DOM is reached through a minimal `ClassListLike` so this is
 * testable without jsdom.
 */

export interface A11yPrefs {
  reducedStimulation: boolean;
  highContrast: boolean;
  dyslexiaFont: boolean;
  largerText: boolean;
}

export const A11Y_DEFAULTS: A11yPrefs = {
  reducedStimulation: false,
  highContrast: false,
  dyslexiaFont: false,
  largerText: false,
};

/** localStorage key read by the inline first-paint script. */
export const A11Y_STORAGE_KEY = "kairo-a11y";

/** Pref → class on <html>. Keys match A11yPrefs exactly. */
export const A11Y_CLASSES: Record<keyof A11yPrefs, string> = {
  reducedStimulation: "reduced-stimulation",
  highContrast: "high-contrast",
  dyslexiaFont: "dyslexia-font",
  largerText: "larger-text",
};

const KEYS = Object.keys(A11Y_CLASSES) as (keyof A11yPrefs)[];

/** Every class this module manages — used to clear stale state. */
export const ALL_A11Y_CLASSES: string[] = KEYS.map((k) => A11Y_CLASSES[k]);

/**
 * `[storageToken, className]` pairs, serialized into the inline first-paint
 * script so the class names live in exactly one place.
 */
export const A11Y_CLASS_PAIRS: [string, string][] = KEYS.map((k) => [k, A11Y_CLASSES[k]]);

interface SettingsShape {
  reducedStimulation?: unknown;
  notificationPrefs?: unknown;
}

/**
 * Read the four prefs out of a settings payload. Anything missing or malformed
 * reads as off — a bad blob must never force a mode the user didn't choose.
 */
export function parseA11yPrefs(settings: unknown): A11yPrefs {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return { ...A11Y_DEFAULTS };
  }
  const s = settings as SettingsShape;
  const prefs =
    s.notificationPrefs && typeof s.notificationPrefs === "object" && !Array.isArray(s.notificationPrefs)
      ? (s.notificationPrefs as Record<string, unknown>)
      : {};
  return {
    reducedStimulation: s.reducedStimulation === true,
    highContrast: prefs.highContrast === true,
    dyslexiaFont: prefs.dyslexiaFont === true,
    largerText: prefs.largerText === true,
  };
}

/** The classes that should be present for these prefs. */
export function a11yClassList(prefs: A11yPrefs): string[] {
  return KEYS.filter((k) => prefs[k]).map((k) => A11Y_CLASSES[k]);
}

export interface ClassListLike {
  add(...tokens: string[]): void;
  remove(...tokens: string[]): void;
}

/** Apply prefs to a class list, clearing the modes that are off. */
export function applyA11yPrefs(prefs: A11yPrefs, classList: ClassListLike): void {
  for (const key of KEYS) {
    const cls = A11Y_CLASSES[key];
    if (prefs[key]) classList.add(cls);
    else classList.remove(cls);
  }
}

/** Compact string for localStorage — only the enabled prefs, comma-joined. */
export function serializeA11yPrefs(prefs: A11yPrefs): string {
  return KEYS.filter((k) => prefs[k]).join(",");
}

/** Inverse of serializeA11yPrefs; tolerates junk, unknown keys, and null. */
export function deserializeA11yPrefs(raw: string | null | undefined): A11yPrefs {
  const out = { ...A11Y_DEFAULTS };
  if (!raw) return out;
  for (const token of raw.split(",")) {
    const key = token.trim() as keyof A11yPrefs;
    if (KEYS.includes(key)) out[key] = true;
  }
  return out;
}

/**
 * Merge the notificationPrefs-backed extras into a prefs blob for PATCHing.
 * `reducedStimulation` is deliberately excluded — it is its own column.
 */
export function writeA11yPrefs(
  notificationPrefs: Record<string, unknown> | null | undefined,
  prefs: A11yPrefs,
): Record<string, unknown> {
  return {
    ...(notificationPrefs ?? {}),
    highContrast: prefs.highContrast,
    dyslexiaFont: prefs.dyslexiaFont,
    largerText: prefs.largerText,
  };
}
