/**
 * Detects the user's IANA timezone from the browser.
 * Falls back to UTC if the API is unavailable.
 */
export function detectTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz.includes("/")) return tz;
  } catch {}
  return "UTC";
}
