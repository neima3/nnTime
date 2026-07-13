import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config — migrations are generated from src/server/db/schema.ts.
 * `pnpm db:generate` regenerates SQL; `pnpm db:migrate` applies them.
 * DATABASE_URL is set in .env.local locally and in Coolify env for staging/prod.
 */
export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost/kairo_dev",
  },
  verbose: true,
  strict: true,
});
