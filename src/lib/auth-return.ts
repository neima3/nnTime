export const DEFAULT_AUTH_RETURN_TO = "/app/today";

const AUTH_BASE = "https://kairo.invalid";

export function safeAuthReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return DEFAULT_AUTH_RETURN_TO;
  }

  try {
    const url = new URL(value, AUTH_BASE);
    if (
      url.origin !== AUTH_BASE ||
      (url.pathname !== "/app" && !url.pathname.startsWith("/app/"))
    ) {
      return DEFAULT_AUTH_RETURN_TO;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_AUTH_RETURN_TO;
  }
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
