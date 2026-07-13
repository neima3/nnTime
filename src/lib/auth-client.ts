/**
 * Better Auth client — used by Client Components for sign-in/up/out.
 * ADR-003: session managed via HttpOnly cookies (server-side); the client
 * just triggers the auth flows and reads session state.
 */
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;
