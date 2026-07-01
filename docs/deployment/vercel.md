# Vercel Deployment (New)

Host the **SPA and the API on Vercel** as one project: the Vite build is served as static assets and the Fastify API runs as a Node **serverless function** under `/api/*`. Because Vercel functions can't reach CloudSQL/Memorystore on a private VPC, this path uses **serverless-friendly managed data**: **Neon** (PostgreSQL, with connection pooling) and **Upstash** (Redis over TLS).

> **Status: new.** A small serverless adapter and a `vercel.json` need to be added to the repo (snippets below). Items that add files are marked **➕ add**. If you'd rather not run Fastify on serverless, see [Alternative: hybrid](#alternative-hybrid-spa-on-vercel--api-elsewhere) at the end.

```
Vercel project
  /            → frontend/dist (static SPA)
  /api/*       → serverless function → Fastify (buildApp)
                    ├── Neon Postgres (pooled DATABASE_URL)
                    └── Upstash Redis (rediss://)
```

---

## Prerequisites

- [ ] Vercel account + the Vercel CLI (`npm i -g vercel`) or the Git integration
- [ ] A **Neon** project (PostgreSQL) — note both the **pooled** and **direct** connection strings
- [ ] An **Upstash** Redis database — note the `rediss://` URL
- [ ] A **Google OAuth 2.0 client** (Web application)
- [ ] Decide the production domain (Vercel-provided `*.vercel.app` or a custom domain)

## 1. Managed data services

- [ ] **Neon:** create a database; copy the **pooled** connection string (host contains `-pooler`) for `DATABASE_URL`, and the **direct** string for running migrations. Append `?sslmode=require`.
- [ ] **Upstash:** create a Redis database; copy the `rediss://default:<token>@<host>:<port>` URL for `REDIS_URL`.

> Sessions live in Postgres (not Redis), so the API stays stateless across invocations. Redis is used for the response cache (best-effort) and the per-user post rate limiter.

## 2. Prisma for serverless ➕ add

- [ ] In [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma), add Vercel's runtime engine target to the generator:
  ```prisma
  generator client {
    provider      = "prisma-client-js"
    binaryTargets = ["native", "rhel-openssl-3.0.x"]
  }
  ```
- [ ] Use the **pooled** Neon URL for `DATABASE_URL` (Prisma opens a connection per warm instance; the pooler prevents exhausting Postgres). Keep pool size small via the URL, e.g. `&connection_limit=1`.

## 3. Serverless API adapter ➕ add

Add a catch-all function that boots Fastify once per warm instance and forwards requests. Create **`api/[...path].ts`** at the repo root:

```ts
// api/[...path].ts — Vercel Node function handling every /api/* request.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApp } from '../backend/src/app.js';

// Reuse the app across warm invocations (module scope persists per instance).
let appPromise: ReturnType<typeof boot> | null = null;
async function boot() {
  const app = await buildApp();
  await app.ready();
  return app;
}
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await (appPromise ??= boot());
  // Fastify routes are registered under /api/*; req.url already includes it.
  app.server.emit('request', req, res);
}
```

- [ ] **➕ add** `api/[...path].ts` (above)
- [ ] Ensure the function uses the Node.js runtime (default for `.ts` in `api/`) and Node 22 — the root `package.json` already declares `"engines": { "node": ">=22" }`; set Vercel Project Settings → Node version to 22.x to match
- [ ] Bump the function memory/timeout if cold starts are slow (Project Settings → Functions)

## 4. Project config ➕ add

Add **`vercel.json`** at the repo root:

```json
{
  "buildCommand": "corepack pnpm install --frozen-lockfile && corepack pnpm --filter @dml/shared build && corepack pnpm --filter @dml/backend exec prisma generate && corepack pnpm --filter @dml/frontend build",
  "outputDirectory": "frontend/dist",
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

- [ ] **➕ add** `vercel.json` (SPA build + client-side routing fallback; `/api/*` is served by the function automatically and is excluded from the SPA rewrite)
- [ ] `VITE_API_BASE_URL` left unset → SPA calls `/api` on the same origin (no CORS)

## 5. Database migrations

Run against the **direct** (non-pooled) Neon URL — pooled connections can't run DDL reliably:

```bash
DATABASE_URL='postgresql://USER:PASS@<direct-host>/db?sslmode=require' \
  corepack pnpm --filter @dml/backend exec prisma migrate deploy
```

- [ ] Run before promoting a deploy (locally or as a CI step on `main`)
- [ ] Do **not** rely on the runtime to migrate — functions are read-mostly and ephemeral

## 6. Environment variables (Vercel → Project Settings → Environment Variables)

Set for **Production** (and Preview if used). See the [shared table](./README.md#environment-variables-shared-reference) for meanings.

- [ ] `NODE_ENV=production`
- [ ] `APP_BASE_URL=https://<your-domain>`
- [ ] `OAUTH_REDIRECT_URI=https://<your-domain>/api/auth/google/callback`
- [ ] `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- [ ] `SESSION_SIGNING_KEY` (`openssl rand -base64 48`)
- [ ] `DATABASE_URL` (Neon **pooled**)
- [ ] `REDIS_URL` (Upstash `rediss://`)
- [ ] Optional: `NYT_API_KEY`, `GOOGLE_BOOKS_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
- [ ] Optional TTL overrides (`ITEM_TTL_SECONDS`, …) — defaults are fine

> Mark secrets as **Sensitive** in Vercel. Preview deploys should use a **separate** Neon branch/DB and OAuth redirect URI.

## 7. OAuth configuration

- [ ] Google OAuth client → **Authorized redirect URI**: `https://<your-domain>/api/auth/google/callback`
- [ ] **Authorized JavaScript origin**: `https://<your-domain>`
- [ ] For preview URLs, either add each preview redirect URI or restrict OAuth testing to production

## 8. Deploy & verify

```bash
vercel            # preview deploy
vercel --prod     # production
```

- [ ] Build succeeds (shared → prisma generate → SPA); function bundles without Prisma engine errors
- [ ] `https://<domain>` loads the SPA
- [ ] `GET /api/healthz` (or any public route) responds; sign in with Google works end-to-end
- [ ] Post an update; open Discover, Search, My Library, and an item page (Spotify link if keys set)
- [ ] Check **Vercel → Functions logs**: no cold-start timeouts, no Postgres "too many connections" (tune `connection_limit` / pooler), Redis reachable

---

## Caveats (serverless)

- **Cold starts:** Fastify + Prisma boot on a cold instance adds latency; the module-scoped `appPromise` reuses the app on warm instances. Consider a small min-instance/warming strategy if needed.
- **Connections:** always use the Neon **pooler** for `DATABASE_URL` and keep `connection_limit` low; serverless fan-out can otherwise exhaust Postgres.
- **Redis required for rate limiting:** the per-user post limiter uses Redis (`incrWithExpiry`). Upstash covers this; without a reachable Redis the limiter fails closed.
- **Filesystem is ephemeral/read-only** at runtime — fine here (no local writes).

## Alternative: hybrid (SPA on Vercel + API elsewhere)

If running Fastify on serverless is undesirable, deploy only the **SPA** to Vercel and host the **API** on a long-running platform (e.g. GCP Cloud Run per [gcp.md](./gcp.md), Fly.io, or Render), then proxy:

```json
{
  "outputDirectory": "frontend/dist",
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://api.example.com/api/:path*" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

- [ ] API deployed and reachable at a public origin
- [ ] Set `APP_BASE_URL` / `OAUTH_REDIRECT_URI` to the **Vercel** domain (the browser-facing origin)
- [ ] Ensure cookies work across the proxy (same site via the rewrite keeps it first-party)
