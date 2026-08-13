FROM node:24-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable pnpm && corepack prepare pnpm@9.15.9 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# No NEXT_PUBLIC_* build args needed: the VAPID public key is read at request
# time on the server and passed to the client (see app/app/settings/page.tsx).
# It used to be a NEXT_PUBLIC_ var inlined at build time, which silently shipped
# as `undefined` here and quietly disabled push reminders in the image.
RUN pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Migration SQL files (migrations run in-process via migrate-on-startup.ts)
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
USER nextjs
EXPOSE 3000
# Container-level health (8C): /api/health returns 503 only on the hard
# dependencies (DB unreachable / migrations failed) — AI and scheduler are
# explicitly optional there, so this can't flap on soft failures. node:24
# has global fetch; the runtime image ships no curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"
# Migrations run automatically on first DB import (ensureMigrated in db/index.ts).
CMD ["node", "server.js"]
