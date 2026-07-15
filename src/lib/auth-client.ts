/**
 * Better Auth client — Client Components for sign-in/up/out/magic-link.
 * ADR-003: sessions via HttpOnly cookies; client only triggers flows.
 */
import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  // No baseURL → current origin (dev/staging/prod same-origin).
  baseURL: process.env.NEXT_PUBLIC_APP_URL || undefined,
  plugins: [magicLinkClient()],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
} = authClient;
