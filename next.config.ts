import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Ensure server-side packages are traced into the standalone build. The
  // dynamic pages that use server-only imports (db, auth, drizzle) need these
  // included explicitly because the tracer may not follow all import chains.
  outputFileTracingIncludes: {
    "/app/today": ["./node_modules/postgres/**/*", "./node_modules/drizzle-orm/**/*", "./node_modules/better-auth/**/*"],
    "/app/inbox": ["./node_modules/postgres/**/*", "./node_modules/drizzle-orm/**/*", "./node_modules/better-auth/**/*"],
    "/app/routines": ["./node_modules/postgres/**/*", "./node_modules/drizzle-orm/**/*", "./node_modules/better-auth/**/*"],
    "/api/auth/**/*": ["./node_modules/better-auth/**/*"],
    "/api/v1/**/*": ["./node_modules/postgres/**/*", "./node_modules/drizzle-orm/**/*", "./node_modules/better-auth/**/*"],
  },
};

export default nextConfig;
