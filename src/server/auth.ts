/**
 * Better Auth configuration — ADR-003 (web).
 *
 * Magic link + password reset email: Resend when RESEND_API_KEY is set;
 * otherwise log in non-production and no-op in production (no enumeration).
 */
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import db from "./db";
import * as authSchema from "./auth-schema";
import { sendEmail } from "./email";
import {
  accountSecurityOptions,
  createAppleProviderOptions,
  getAppleAuthConfig,
  getGoogleProviderOptions,
  getTrustedOrigins,
} from "./auth-capabilities";
import { buildMagicLinkDeliveryUrl } from "./native-magic-link";

const appleConfig = getAppleAuthConfig(process.env);
const appleProvider = appleConfig
  ? await createAppleProviderOptions(appleConfig)
  : null;
const googleProvider = getGoogleProviderOptions(process.env);
const socialProviders =
  appleProvider || googleProvider
    ? {
        ...(appleProvider ? { apple: appleProvider } : {}),
        ...(googleProvider ? { google: googleProvider } : {}),
      }
    : undefined;

async function deliverAuthEmail(
  kind: string,
  email: string,
  url: string,
): Promise<void> {
  const subject =
    kind === "magic"
      ? "Your Kairo sign-in link"
      : kind === "reset"
        ? "Reset your Kairo password"
        : "Verify your Kairo email";
  const text = `Open this link to continue:\n\n${url}\n\nIf you didn't request this, you can ignore this email.`;
  const result = await sendEmail({ to: email, subject, text });
  if (!result.sent) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[auth] ${kind} email delivery skipped (${result.reason})`);
    }
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  appName: "Kairo",
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://time.neima.me"
      : "http://localhost:3000"),
  trustedOrigins: getTrustedOrigins(process.env),
  socialProviders,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    // ADR-003: a reset is a privilege-sensitive event. Without this Better Auth
    // keeps every standing session valid, so a stolen cookie survives the reset
    // for the full 30-day session lifetime.
    revokeSessionsOnPasswordReset: true,
    sendVerificationEmail: async ({
      user,
      url,
    }: {
      user: { email: string };
      url: string;
    }) => {
      await deliverAuthEmail("verify", user.email, url);
    },
    sendResetPassword: async ({
      user,
      url,
    }: {
      user: { email: string };
      url: string;
    }) => {
      await deliverAuthEmail("reset", user.email, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },
  plugins: [
    magicLink({
      expiresIn: 60 * 15,
      sendMagicLink: async ({ email, url, token, metadata }) => {
        await deliverAuthEmail(
          "magic",
          email,
          buildMagicLinkDeliveryUrl({
            token,
            defaultUrl: url,
            metadata,
          }),
        );
      },
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    // Deliberately OFF. The cookie cache answers `getSession` straight from the
    // signed cookie without reading the session row, which silently defeats
    // every server-side revocation for up to its maxAge:
    //  - `revokeSessionsOnPasswordReset` above — a stolen cookie outlived the
    //    reset that was supposed to kill it;
    //  - account deletion — the deleted user stayed authenticated, and the
    //    planner answered 500 (writes against a user id that no longer exists)
    //    instead of 401.
    // Revocation has to be immediate to mean anything, and every authenticated
    // request in this app already hits Postgres, so the saved lookup buys little.
    cookieCache: { enabled: false },
  },
  account: accountSecurityOptions,
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
    window: 10,
    max: 10,
  },
});

export type Auth = typeof auth;
