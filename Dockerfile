# =============================================================================
# Stage 1: Builder
# =============================================================================
FROM node:22.13.0-alpine AS builder

# Install pnpm via npm to avoid corepack signature verification issues
RUN npm install -g pnpm

WORKDIR /app

# ── Install dependencies ──────────────────────────────────────────────────────
# Copy only lockfiles first so Docker can cache this layer
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./

RUN pnpm install --frozen-lockfile

# ── Copy source ───────────────────────────────────────────────────────────────
COPY . .

# ── Build ─────────────────────────────────────────────────────────────────────
# DATABASE_URL is only parsed at env-load time; the build itself never
# connects to Postgres.
ENV DATABASE_URL="postgresql://build_placeholder@localhost:5432/build_placeholder"

RUN pnpm build

# =============================================================================
# Stage 2: Production runner
# =============================================================================
FROM node:22.13.0-alpine AS runner

# Install pnpm via npm (same approach as builder)
RUN npm install -g pnpm

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# ── Copy package manifests ────────────────────────────────────────────────────
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# ── Copy node_modules from builder ───────────────────────────────────────────
# All node_modules are copied because vinext/vite are required at runtime by
# `vinext start`, and postgres/drizzle are needed by the migration script.
COPY --from=builder /app/node_modules ./node_modules

# ── Copy build artifacts ──────────────────────────────────────────────────────
COPY --from=builder /app/dist ./dist

# ── Copy static public assets ─────────────────────────────────────────────────
COPY --from=builder /app/public ./public

# ── Copy database migration files & runner script ─────────────────────────────
COPY --from=builder /app/postgres-migrations ./postgres-migrations
COPY --from=builder /app/scripts/migrate-postgres.mjs ./scripts/migrate-postgres.mjs

# ── Copy next.config.ts (read by vinext at start) ────────────────────────────
COPY --from=builder /app/next.config.ts ./next.config.ts

# ── Expose port ───────────────────────────────────────────────────────────────
# Coolify detects EXPOSE automatically.
EXPOSE 3000

# ── Startup: run migrations then start the production server ──────────────────
# DATABASE_URL and all other secrets are injected at runtime by Coolify.
CMD ["sh", "-c", "node scripts/migrate-postgres.mjs && npx vinext start"]
