/**
 * Better Auth catch-all route handler — ADR-003.
 *
 * Mounts Better Auth's HTTP handler at /api/auth/* (sign-in/up/out, magic-link
 * callback, email verification, session refresh). All auth endpoints are
 * CSRF-protected by Better Auth (Origin check on mutations) and rate-limited.
 */
import { auth } from "@/server/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
