/**
 * Redaction for client-error telemetry — 6.2 `client_error_reports`
 * (ADR-005 SEC-03/SEC-05).
 *
 * A browser's `message`/`stack`/`path` strings routinely interpolate the
 * thing that just failed: a fetch's request URL, a header dump, the current
 * location. That can carry an `Authorization` header, a raw `Bearer` token, a
 * `Cookie`/`Set-Cookie` value, a `token=`/`key=`-style query secret (which
 * covers magic-link verification links — they pass the token as a query
 * param), or an ICS/webcal calendar feed URL (SEC-04: those often embed a
 * secret in the path). None of that belongs in a durably-stored error row.
 *
 * Pure function — no I/O, no DB. Call it BEFORE insert, not after: this is
 * the only backstop between a pasted stack trace and permanent storage.
 * Deliberately scoped to the leak shapes named in the 6.2 plan; broaden with
 * a new unit test if another shape turns up in the wild rather than
 * loosening these patterns.
 */

const REDACTED = "[redacted]";

/** `Authorization: <scheme> <credential>` or `Authorization: <credential>`. */
const AUTHORIZATION_HEADER = /\bauthorization\s*:\s*\S+(?:\s+\S+)?/gi;

/** A raw bearer token, with or without a preceding `Authorization:`. */
const BEARER_TOKEN = /\bbearer\s+[^\s"'&,;]+/gi;

/** `Cookie: ...` / `Set-Cookie: ...` — redact the whole header value. */
const COOKIE_HEADER = /\b(set-cookie|cookie)\s*:\s*[^\n\r]+/gi;

/**
 * `?token=…`, `&key=…`, `apiKey=…`, `api_key=…`, `access_token=…`,
 * `refresh_token=…` — query-string secrets, including magic-link
 * verification tokens (always passed this way).
 */
const QUERY_SECRET =
  /([?&](?:token|key|api[_-]?key|access[_-]?token|refresh[_-]?token|magic[_-]?token)=)[^&\s"'#]+/gi;

/** `webcal://…` feed URLs (any path). */
const WEBCAL_URL = /\bwebcal:\/\/[^\s"'<>]+/gi;

/** `http(s)://…` URLs ending in `.ics` (optionally with a query string). */
const ICS_URL = /\bhttps?:\/\/[^\s"'<>]*\.ics(?:\?[^\s"'<>]*)?/gi;

/**
 * Redact one telemetry field. `null`/`undefined` pass through unchanged so
 * callers can redact `message`, `stack`, and `path` uniformly without a
 * presence check at every call site.
 */
export function redactErrorText<T extends string | null | undefined>(
  value: T,
): T {
  if (value === null || value === undefined) return value;
  let out: string = value;
  out = out.replace(AUTHORIZATION_HEADER, `authorization: ${REDACTED}`);
  out = out.replace(BEARER_TOKEN, `Bearer ${REDACTED}`);
  out = out.replace(COOKIE_HEADER, (_m, name: string) => `${name}: ${REDACTED}`);
  out = out.replace(QUERY_SECRET, `$1${REDACTED}`);
  out = out.replace(WEBCAL_URL, REDACTED);
  out = out.replace(ICS_URL, REDACTED);
  return out as T;
}

/** Redact the three free-text fields of a client error report together. */
export function redactClientErrorReport<
  T extends { message: string; stack?: string | null; path?: string | null },
>(report: T): T {
  return {
    ...report,
    message: redactErrorText(report.message),
    stack: redactErrorText(report.stack ?? null),
    path: redactErrorText(report.path ?? null),
  };
}
