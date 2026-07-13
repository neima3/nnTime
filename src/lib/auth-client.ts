/**
 * Better Auth client — used by Client Components for sign-in/up/out.
 * ADR-003: session managed via HttpOnly cookies (server-side); the client
 * just triggers the auth flows and reads session state.
 */
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // No baseURL → Better Auth targets the current origin (window.location) in the
  // browser. The app is always served same-origin as its /api/auth handler, so
  // this is correct in dev (any port), staging, and prod. An explicit
  // NEXT_PUBLIC_APP_URL override is honored if set.
  baseURL: process.env.NEXT_PUBLIC_APP_URL || undefined,
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;
