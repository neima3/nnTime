/**
 * Better Auth configuration — ADR-003 (web).
 *
 * Binding contract:
 *  - Methods at launch: email+password (verification email required before
 *    first planner write) AND magic link (single-use, 15-min expiry, no account
 *    enumeration via generic "check your email" response).
 *  - Sessions: HttpOnly, Secure, SameSite=Lax; 30-day absolute; rotation on
 *    privilege-sensitive events; logout + revoke-all-devices.
 *  - Canonical origin https://time.neima.me; trustedOrigins limited to it.
 *  - CSRF: cookie-authenticated mutations require Origin check; no state on GET.
 *  - Rate limits on signup/login/reset/magic-link (1C wires via SEC-06).
 *
 * Google sign-in added in Phase 8B (web + iOS together). Sign in with Apple
 * is Phase 7B (iOS). Magic-link email transport = Resend (key via op).
 */
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import db from "./db";
import * as authSchema from "./auth-schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  appName: "Kairo",
  // Canonical origin (ADR-003). Defaults to the prod URL in production so auth
  // works even if BETTER_AUTH_URL isn't set in the Coolify env; an explicit
  // BETTER_AUTH_URL (e.g. staging) always wins.
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://time.neima.me"
      : "http://localhost:3000"),
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    "http://localhost:3000",
    "http://localhost:3456", // pinned dev port (.claude/launch.json)
    "https://time.neima.me",
    "https://time-staging.neima.me",
  ].filter(Boolean),
  emailAndPassword: {
    enabled: true,
    // ADR-003: verification required before first planner write. Temporarily
    // disabled until Resend is provisioned (RESEND_API_KEY via op). The auth
    // tables + flow work; verification email just isn't sent yet.
    requireEmailVerification: false,
    sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
      // Phase 1C: log in dev; Resend wired when the API key is provisioned.
      if (process.env.NODE_ENV !== "production") {
         
        console.log(`[auth] verification email for ${user.email}: ${url}`);
      }
      // TODO(1C): Resend transport once RESEND_API_KEY is provisioned via op.
    },
    sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
      if (process.env.NODE_ENV !== "production") {
         
        console.log(`[auth] reset email for ${user.email}: ${url}`);
      }
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },
  // Better Auth 1.6+: magic link is a *plugin*, not a top-level option.
  plugins: [
    magicLink({
      expiresIn: 60 * 15, // 15 min single-use (ADR-003)
      sendMagicLink: async ({ email, url }) => {
        // ADR-003: no account enumeration — always "check your email" UX.
        // Transport: log in dev; Resend when RESEND_API_KEY is present.
        if (process.env.NODE_ENV !== "production") {
           
          console.log(`[auth] magic link for ${email}: ${url}`);
        }
        // TODO: Resend once provisioned.
      },
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30-day absolute
    updateAge: 60 * 60 * 24, // refresh the cookie daily
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  advanced: {
    crossSubDomainCookies: { enabled: false },
    defaultCookieAttributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  },
  rateLimit: {
    enabled: true,
    // Better Auth's built-in limiter handles auth-endpoint floods; the
    // /api/v1 data endpoints use the Postgres-backed SEC-06 framework in
    // src/server/ratelimit for finer-grained per-account + per-IP limits.
    window: 10,
    max: 10,
  },
});

export type Auth = typeof auth;
