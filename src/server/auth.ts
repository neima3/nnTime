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
       
      console.log(`[auth] ${kind} for ${email}: ${url} (${result.reason})`);
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
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    "http://localhost:3000",
    "http://localhost:3456",
    "https://time.neima.me",
    "https://time-staging.neima.me",
  ].filter(Boolean),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
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
      sendMagicLink: async ({ email, url }) => {
        await deliverAuthEmail("magic", email, url);
      },
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
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
    window: 10,
    max: 10,
  },
});

export type Auth = typeof auth;
