export const DEFAULT_AUTH_RETURN_TO = "/app/today";

const AUTH_BASE = "https://kairo.invalid";
const MALFORMED_PERCENT_ESCAPE = /%(?![0-9a-f]{2})/i;
const ENCODED_PATH_DELIMITER_OR_CONTROL =
  /%(?:2f|3f|23|5c|0[0-9a-f]|1[0-9a-f]|7f)/i;
const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/;
const DOT_PATH_SEGMENT = /(?:^|\/)\.{1,2}(?:\/|$)/;

function hasUnsafeEncoding(value: string): boolean {
  let decoded = value;

  for (let depth = 0; depth < 8; depth += 1) {
    if (CONTROL_OR_BACKSLASH.test(decoded)) return true;

    const path = decoded.split(/[?#]/, 1)[0];
    if (path.startsWith("//") || DOT_PATH_SEGMENT.test(path)) return true;
    if (MALFORMED_PERCENT_ESCAPE.test(decoded)) return true;
    if (!decoded.includes("%")) return false;
    if (ENCODED_PATH_DELIMITER_OR_CONTROL.test(path)) return true;

    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) return false;
      decoded = next;
    } catch {
      return true;
    }
  }

  return decoded.includes("%");
}

export function safeAuthReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    hasUnsafeEncoding(value)
  ) {
    return DEFAULT_AUTH_RETURN_TO;
  }

  try {
    const url = new URL(value, AUTH_BASE);
    const isOnboarding =
      url.pathname === "/onboarding" && url.search === "" && url.hash === "";
    if (
      url.origin !== AUTH_BASE ||
      (!isOnboarding &&
        url.pathname !== "/app" &&
        !url.pathname.startsWith("/app/"))
    ) {
      return DEFAULT_AUTH_RETURN_TO;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_AUTH_RETURN_TO;
  }
}

export function appReturnTo(
  pathname: string,
  values: Record<string, string | number | undefined> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const search = params.toString();
  return safeAuthReturnTo(search ? `${pathname}?${search}` : pathname);
}

export function authPageHref(
  mode: "sign-in" | "sign-up",
  returnTo: string,
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams({
    ...extra,
    next: safeAuthReturnTo(returnTo),
  });
  return `/${mode}?${params}`;
}
