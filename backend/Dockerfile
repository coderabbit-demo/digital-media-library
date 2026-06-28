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
# The backend's postinstall runs `prisma generate`, so the schema must be present
# during install — copy it before installing.
COPY backend/prisma backend/prisma

# Install all workspace deps (including dev for the build).
RUN pnpm install --frozen-lockfile

# Copy sources and build shared + backend.
COPY packages/shared packages/shared
COPY backend backend

RUN pnpm --filter @dml/backend prisma generate \
  && pnpm --filter @dml/shared build \
  && pnpm --filter @dml/backend build

# Prune to production dependencies for a slim runtime.
RUN pnpm --filter @dml/backend deploy --prod /app/deploy

# `pnpm deploy` reinstalls @prisma/client from the store (the un-generated stub),
# dropping the client generated above. Copy the generated client into the pruned
# tree so the runtime can import it. Both trees share the same .pnpm layout.
RUN set -eux; \
  gen="$(ls -d /app/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma)"; \
  dst="$(ls -d /app/deploy/node_modules/.pnpm/@prisma+client@*/node_modules)"; \
  rm -rf "$dst/.prisma"; cp -R "$gen" "$dst/.prisma"

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

# --conditions=dml-runtime makes @dml/shared resolve to its built dist (the JS),
# not its TS source — Node can't strip types under node_modules. Only the prod
# container sets this; dev/test/build keep using the source via the default.
CMD ["node", "--conditions=dml-runtime", "dist/server.js"]
