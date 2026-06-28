# Multi-stage build for the @dml/backend Cloud Run service.
# Cloud Run injects PORT (default 8080); the app binds 0.0.0.0:$PORT.

# ---- Builder ----------------------------------------------------------------
FROM node:22-slim AS builder
WORKDIR /app

# Prisma needs openssl to generate/run the client.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Enable pnpm via corepack (monorepo uses pnpm workspaces).
RUN corepack enable

# Copy workspace manifests first for cached installs.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/

# Install all workspace deps (including dev for the build).
RUN pnpm install --frozen-lockfile

# Copy sources and build shared + backend.
COPY packages/shared packages/shared
COPY backend backend

RUN pnpm --filter @dml/backend prisma generate \
  && pnpm --filter @dml/shared build \
  && pnpm --filter @dml/backend build

# Prune to production dependencies for a slim runtime.
RUN pnpm --filter @dml/backend deploy --prod --legacy /app/deploy

# ---- Migration runner -------------------------------------------------------
# Reuses the builder (full deps incl. the Prisma CLI + migrations) to apply
# pending migrations and exit. Run as a one-off Cloud Run Job (build with
# `--target migrate`); the slim runtime image below has no Prisma CLI.
FROM builder AS migrate
WORKDIR /app
CMD ["pnpm", "--filter", "@dml/backend", "exec", "prisma", "migrate", "deploy"]

# ---- Runtime ----------------------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Run as the unprivileged node user.
USER node

# Pruned production deps + compiled output + generated Prisma client.
COPY --chown=node:node --from=builder /app/deploy/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/backend/dist ./dist
COPY --chown=node:node --from=builder /app/backend/prisma ./prisma

# Cloud Run provides PORT; default for local runs.
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/server.js"]
