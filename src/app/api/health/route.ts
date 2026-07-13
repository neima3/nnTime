/**
 * Health endpoint — Coolify healthcheck target (roadmap 1B).
 *
 * Returns 200 `{status:"ok"}` with a short max-age cache-control so probes
 * stay cheap. This is NOT auth-gated (it must be reachable for the healthcheck)
 * and leaks no user data.
 *
 * A deeper liveness check (DB roundtrip, scheduler lag per ADR-004) is added
 * once those subsystems exist (1C/2B). For 1B the endpoint confirms the app
 * process is up and serving.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    { status: "ok", timestamp: new Date().toISOString() },
    {
      status: 200,
      headers: { "cache-control": "public, max-age=5" },
    },
  );
}
