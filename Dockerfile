# =============================================================================
# Stage 1: Builder
# =============================================================================
FROM node:22.13.0-alpine AS builder

# Enable corepack so pnpm is available (version pinned via lockfile)
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# ── Install dependencies ──────────────────────────────────────────────────────
# Copy only lockfiles first so Docker can cache this layer
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./

RUN pnpm install --frozen-lockfile

# ── Copy source ───────────────────────────────────────────────────────────────
COPY . .

# ── Build ─────────────────────────────────────────────────────────────────────
# DATABASE_URL is required only by migration scripts; the build itself never
# connects to Postgres, but some env parsing runs at config time.
ENV DATABASE_URL="postgresql://build_placeholder@localhost:5432/build_placeholder"

RUN pnpm build

# =============================================================================
# Stage 2: Production runner
# =============================================================================
FROM node:22.13.0-alpine AS runner

# Install corepack for pnpm (needed to run the migration script)
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# ── Copy package manifests (needed by pnpm and node module resolution) ────────
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# ── Copy node_modules from builder ───────────────────────────────────────────
# vinext, vite, postgres, drizzle-kit etc. are all needed at runtime for:
#   - `vinext start`  (vinext/vite serve the dist/ folder)
#   - `db:migrate`    (postgres driver, scripts/)
COPY --from=builder /app/node_modules ./node_modules

# ── Copy build artifacts ──────────────────────────────────────────────────────
COPY --from=builder /app/dist ./dist

# ── Copy static public assets ─────────────────────────────────────────────────
COPY --from=builder /app/public ./public

# ── Copy database migration files & migration runner ─────────────────────────
COPY --from=builder /app/postgres-migrations ./postgres-migrations
COPY --from=builder /app/scripts/migrate-postgres.mjs ./scripts/migrate-postgres.mjs

# ── Copy next.config.ts (read by vinext at start) ────────────────────────────
COPY --from=builder /app/next.config.ts ./next.config.ts

# ── Expose port ───────────────────────────────────────────────────────────────
# Coolify will pick this up automatically.
EXPOSE 3000

# ── Startup: run migrations then start the production server ──────────────────
# DATABASE_URL and other secrets are injected at runtime by Coolify.
CMD ["sh", "-c", "node scripts/migrate-postgres.mjs && npx vinext start"]
