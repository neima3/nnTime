/**
 * Better Auth catch-all route handler — ADR-003.
 *
 * Mounts Better Auth's HTTP handler at /api/auth/* (sign-in/up/out, magic-link
 * callback, email verification, session refresh). All auth endpoints are
 * CSRF-protected by Better Auth (Origin check on mutations) and rate-limited.
 *
 * Migrations are ensured before processing so the auth tables exist.
 */
import { auth } from "@/server/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { ensureMigrated } from "@/server/db/migrate-on-startup";

// Wrap the handler to ensure migrations have run.
const handlers = toNextJsHandler(auth);

export async function GET(request: Request) {
  await ensureMigrated();
  return handlers.GET!(request);
}

export async function POST(request: Request) {
  await ensureMigrated();
  return handlers.POST!(request);
}
