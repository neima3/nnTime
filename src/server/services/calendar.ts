/**
 * Calendar import service — Phase 5A (strong model for sync correctness).
 *
 * Binding contract (ADR-005):
 *  - Google OAuth: read-only scope, offline access. Tokens envelope-encrypted
 *    (AES-256-GCM) with a key in env (op-sourced), NOT in Postgres. Least
 *    scope. Rotation/expiry/revocation/disconnect/delete cascade.
 *  - ICS subscribe with FULL SSRF controls (SEC-04): http/https only, resolve
 *    DNS then verify every hop's IP is public (re-verify on each redirect, max
 *    3 redirects), response cap 5 MB, timeout 10s, content-type/structure
 *    validation, URLs encrypted at rest + redacted in logs.
 *
 * Imported events become read-only locked blocks (source='calendar').
 */
import "server-only";
import dns from "node:dns/promises";
import net from "node:net";
import { z } from "zod";
import { isValidZone, wallClockToInstant } from "../temporal/zone";

const MAX_ICS_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Returns true only if `ip` is a public unicast address suitable for outbound
 * ICS fetch. Blocks loopback, RFC1918, link-local/metadata, CGNAT, ULA, and
 * IPv4-mapped private addresses (SEC-04).
 */
export function isPublicIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isPublicIpv4(ip);
  if (version === 6) return isPublicIpv6(ip);
  return false;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

function inCidr(ipInt: number, base: number, prefixLen: number): boolean {
  if (prefixLen === 0) return true;
  const mask = (0xffffffff << (32 - prefixLen)) >>> 0;
  return (ipInt & mask) === (base & mask);
}

function isPublicIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return false;

  // 0.0.0.0 (unspecified / this-host)
  if (n === 0) return false;
  // 127.0.0.0/8 loopback
  if (inCidr(n, 0x7f000000, 8)) return false;
  // 10.0.0.0/8
  if (inCidr(n, 0x0a000000, 8)) return false;
  // 172.16.0.0/12
  if (inCidr(n, 0xac100000, 12)) return false;
  // 192.168.0.0/16
  if (inCidr(n, 0xc0a80000, 16)) return false;
  // 169.254.0.0/16 link-local + cloud metadata
  if (inCidr(n, 0xa9fe0000, 16)) return false;
  // 100.64.0.0/10 CGNAT
  if (inCidr(n, 0x64400000, 10)) return false;

  return true;
}

/** Expand IPv6 to 8 hextets; supports dotted IPv4 tail. */
function expandIpv6(ip: string): number[] | null {
  const bare = ip.split("%")[0]!;
  let s = bare;

  const dotted = /^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(s);
  if (dotted) {
    const octets = dotted[2]!.split(".").map(Number);
    if (octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return null;
    const hi = ((octets[0]! << 8) | octets[1]!).toString(16);
    const lo = ((octets[2]! << 8) | octets[3]!).toString(16);
    s = `${dotted[1]}${hi}:${lo}`;
  }

  let parts: string[];
  if (s.includes("::")) {
    if (s.indexOf("::") !== s.lastIndexOf("::")) return null;
    const [left = "", right = ""] = s.split("::");
    const leftParts = left === "" ? [] : left.split(":");
    const rightParts = right === "" ? [] : right.split(":");
    const missing = 8 - leftParts.length - rightParts.length;
    if (missing < 0) return null;
    parts = [...leftParts, ...Array<string>(missing).fill("0"), ...rightParts];
  } else {
    parts = s.split(":");
  }

  if (parts.length !== 8) return null;
  const hextets = parts.map((h) => {
    if (h === "" || !/^[0-9a-fA-F]{1,4}$/.test(h)) return NaN;
    return parseInt(h, 16);
  });
  if (hextets.some((h) => Number.isNaN(h) || h < 0 || h > 0xffff)) return null;
  return hextets;
}

function isPublicIpv6(ip: string): boolean {
  const hextets = expandIpv6(ip);
  if (!hextets) return false;

  // IPv4-mapped ::ffff:0:0/96 — classify via embedded IPv4
  if (
    hextets[0] === 0 &&
    hextets[1] === 0 &&
    hextets[2] === 0 &&
    hextets[3] === 0 &&
    hextets[4] === 0 &&
    hextets[5] === 0xffff
  ) {
    const a = hextets[6]!;
    const b = hextets[7]!;
    const v4 = `${a >> 8}.${a & 0xff}.${b >> 8}.${b & 0xff}`;
    return isPublicIpv4(v4);
  }

  // ::1 loopback
  if (
    hextets[0] === 0 &&
    hextets[1] === 0 &&
    hextets[2] === 0 &&
    hextets[3] === 0 &&
    hextets[4] === 0 &&
    hextets[5] === 0 &&
    hextets[6] === 0 &&
    hextets[7] === 1
  ) {
    return false;
  }

  // fc00::/7 unique local
  if ((hextets[0]! & 0xfe00) === 0xfc00) return false;
  // fe80::/10 link-local
  if ((hextets[0]! & 0xffc0) === 0xfe80) return false;

  return true;
}

function hostnameOf(url: URL): string {
  // URL.hostname strips brackets for IPv6 literals.
  return url.hostname;
}

/** Residual DNS rebinding after resolve is acceptable; best-effort pre-fetch check only. */
async function assertPublicTarget(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (!isPublicIp(hostname)) {
      throw new Error("ICS URL resolves to a non-public address");
    }
    return;
  }

  const results = await dns.lookup(hostname, { all: true, verbatim: true });
  if (results.length === 0) {
    throw new Error("ICS URL resolves to a non-public address");
  }
  for (const { address } of results) {
    if (!isPublicIp(address)) {
      throw new Error("ICS URL resolves to a non-public address");
    }
  }
}

function assertHttpUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("ICS URL must be http or https");
  }
}

/** SSRF-safe ICS fetch — SEC-04 binding. */
export async function fetchIcs(url: string): Promise<string> {
  let current = new URL(url);
  assertHttpUrl(current);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let redirects = 0;

  try {
    while (true) {
      assertHttpUrl(current);
      await assertPublicTarget(hostnameOf(current));

      const response = await fetch(current.href, {
        signal: controller.signal,
        redirect: "manual",
        headers: { "user-agent": "Kairo-Calendar-Sync/1.0" },
      });

      if (response.status >= 300 && response.status < 400) {
        // Drain/cancel body so the connection can close cleanly.
        try {
          await response.body?.cancel();
        } catch {
          /* ignore */
        }
        if (redirects >= MAX_REDIRECTS) {
          throw new Error("ICS fetch exceeded max redirects");
        }
        const location = response.headers.get("location");
        if (!location) throw new Error("ICS redirect missing Location");
        current = new URL(location, current);
        redirects += 1;
        continue;
      }

      if (!response.ok) throw new Error(`ICS fetch failed: ${response.status}`);

      // Content-type validation.
      const ct = response.headers.get("content-type") ?? "";
      if (
        !ct.includes("text/calendar") &&
        !ct.includes("octet-stream") &&
        !ct.includes("text/plain")
      ) {
        throw new Error(`ICS URL returned unexpected content-type: ${ct}`);
      }

      const contentLength = response.headers.get("content-length");
      if (contentLength && Number(contentLength) > MAX_ICS_BYTES) {
        throw new Error("ICS response exceeds 5 MB");
      }

      const text = await response.text();
      if (text.length > MAX_ICS_BYTES) throw new Error("ICS response exceeds 5 MB");

      if (!text.includes("BEGIN:VCALENDAR")) throw new Error("Invalid ICS: no VCALENDAR");

      return text;
    }
  } finally {
    clearTimeout(timeout);
  }
}

/** Parsed ICS VEVENT. `start`/`end` are absolute instants; all-day events also
 * carry the calendar day the feed literally names (ADR-001: date-only values
 * are days, never midnight-UTC instants). */
export type IcsEvent = {
  uid: string;
  title: string;
  start?: Date;
  end?: Date;
  allDay: boolean;
  /** All-day only: DTSTART as `YYYY-MM-DD`. */
  startDate?: string;
  /** All-day only: DTEND as `YYYY-MM-DD` (exclusive, per RFC 5545). */
  endDate?: string;
};

/**
 * DATE (`20260718`), floating/zoned DATE-TIME (`20260717T100000`) or UTC
 * DATE-TIME (`20260717T140000Z`) — RFC 5545 §3.3.4/§3.3.5.
 */
const icsDateValue = z
  .string()
  .regex(/^\d{8}(T\d{6}Z?)?$/)
  .transform((v) => ({
    year: Number(v.slice(0, 4)),
    month: Number(v.slice(4, 6)) - 1,
    day: Number(v.slice(6, 8)),
    hour: v.length > 8 ? Number(v.slice(9, 11)) : 0,
    minute: v.length > 8 ? Number(v.slice(11, 13)) : 0,
    second: v.length > 8 ? Number(v.slice(13, 15)) : 0,
    dateOnly: v.length === 8,
    utc: v.endsWith("Z"),
  }));

type IcsProperty = { params: Record<string, string>; value: string };

/** Unfold RFC 5545 continuation lines (CRLF + single space/tab). */
function unfold(icsText: string): string {
  return icsText.replace(/\r?\n[ \t]/g, "");
}

function unescapeText(v: string): string {
  return v
    .replace(/\\n/gi, " ")
    .replace(/\\([,;\\])/g, "$1")
    .trim();
}

function property(block: string, key: string): IcsProperty | undefined {
  const m = new RegExp(`^${key}((?:;[^:\\r\\n]*)?):(.*)$`, "m").exec(block);
  if (!m) return undefined;
  const params: Record<string, string> = {};
  for (const part of m[1]!.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    params[part.slice(0, eq).trim().toUpperCase()] = part
      .slice(eq + 1)
      .trim()
      .replace(/^"|"$/g, "");
  }
  return { params, value: m[2]!.trim() };
}

/** TZID may be quoted or Outlook-prefixed (`/America/New_York`). */
function resolveZone(tzid: string | undefined, fallback: string): string {
  const candidate = tzid?.replace(/^\//, "");
  return candidate && isValidZone(candidate) ? candidate : fallback;
}

/**
 * Resolve an ICS date value to a UTC instant.
 *  - `…Z` → already absolute.
 *  - TZID-qualified local wall time → resolved in that zone (DST gap/fold per
 *    ADR-001 via `wallClockToInstant`).
 *  - floating local time / DATE → resolved in `zone` (the importer's planning
 *    zone).
 */
function icsInstant(prop: IcsProperty, zone: string): Date | undefined {
  const parsed = icsDateValue.safeParse(prop.value);
  if (!parsed.success) return undefined;
  const p = parsed.data;
  if (p.utc) {
    return new Date(Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second));
  }
  return wallClockToInstant(
    p.year,
    p.month,
    p.day,
    p.hour,
    p.minute,
    p.second,
    resolveZone(prop.params.TZID, zone),
  );
}

function icsDateOnly(prop: IcsProperty): string | undefined {
  const parsed = icsDateValue.safeParse(prop.value);
  if (!parsed.success || !parsed.data.dateOnly) return undefined;
  return `${prop.value.slice(0, 4)}-${prop.value.slice(4, 6)}-${prop.value.slice(6, 8)}`;
}

/**
 * Parse ICS text into events. Minimal VEVENT extraction.
 *
 * `zone` is the importing user's planning zone: it resolves floating local
 * times and all-day days (never UTC midnight — ADR-001).
 */
export function parseIcs(icsText: string, zone = "UTC"): IcsEvent[] {
  const events: IcsEvent[] = [];
  const vevents = unfold(icsText).match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
  for (const block of vevents) {
    const uid = property(block, "UID")?.value ?? crypto.randomUUID();
    const summary = property(block, "SUMMARY")?.value;
    const dtstart = property(block, "DTSTART");
    const dtend = property(block, "DTEND");
    const startDate = dtstart ? icsDateOnly(dtstart) : undefined;
    const endDate = dtend ? icsDateOnly(dtend) : undefined;
    events.push({
      uid,
      title: summary ? unescapeText(summary) : "Untitled",
      start: dtstart ? icsInstant(dtstart, zone) : undefined,
      end: dtend ? icsInstant(dtend, zone) : undefined,
      allDay: !!startDate || dtstart?.params.VALUE === "DATE",
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    });
  }
  return events;
}

/**
 * Envelope-encrypt a token (SEC-03). Uses AES-256-GCM with a key from env.
 * The encrypted blob is safe to store in Postgres; the key is NOT.
 */
export async function encryptToken(plaintext: string): Promise<string> {
  const keyStr = process.env.ENCRYPTION_KEY;
  if (!keyStr) throw new Error("ENCRYPTION_KEY not configured");
  const key = await crypto.subtle.importKey(
    "raw",
    Buffer.from(keyStr, "hex"),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    Buffer.from(plaintext),
  );
  return `${Buffer.from(iv).toString("base64")}:${Buffer.from(encrypted).toString("base64")}`;
}

/** Decrypt an envelope-encrypted token. */
export async function decryptToken(encrypted: string): Promise<string> {
  const keyStr = process.env.ENCRYPTION_KEY;
  if (!keyStr) throw new Error("ENCRYPTION_KEY not configured");
  const key = await crypto.subtle.importKey(
    "raw",
    Buffer.from(keyStr, "hex"),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const [ivB64, dataB64] = encrypted.split(":");
  const iv = Buffer.from(ivB64!, "base64");
  const data = Buffer.from(dataB64!, "base64");
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return Buffer.from(decrypted).toString();
}
