# Deployment

Production deployment guides for the Digital Media Library. Two supported paths:

| Method | Status | Guide | Best for |
|--------|--------|-------|----------|
| **GCP** (Cloud Run + CloudSQL + Memorystore) | ✅ Planned / infra built | [gcp.md](./gcp.md) | The canonical, fully-private production target (Terraform-managed). |
| **Vercel** (SPA + serverless API) | 🆕 New | [vercel.md](./vercel.md) | Fast previews / lower-ops hosting using serverless managed data (Neon + Upstash). |

Both serve the same app: a React/Vite SPA and a Fastify/Node 22 API (`/api/*`) sharing one origin, backed by PostgreSQL (Prisma) and Redis, with Google OAuth.

---

## Architecture recap

```
            ┌──────────── one origin ────────────┐
 Browser ──▶│  /            → SPA (static, Vite)   │
            │  /api/*       → Fastify API (Node)   │──▶ PostgreSQL (Prisma)
            └─────────────────────────────────────┘──▶ Redis (cache + rate limit)
                                  │
                                  └──▶ Google OAuth 2.0 / OIDC
```

- **Sessions** are stored in PostgreSQL (`Session` table) and carried in a signed, HTTP-only cookie — the API is stateless and horizontally scalable.
- **Redis** is used for the provider/response cache (best-effort) and the per-user post **rate limiter** (`incrWithExpiry`). A Redis outage degrades caching gracefully but the limiter needs Redis.
- **External providers** are keyless by default (NYT, Google Books, Apple/iTunes); optional keys raise quotas. **Spotify** (item-page links) uses the client-credentials flow and is optional.

---

## Environment variables (shared reference)

Both guides set the same backend variables. **S** = store as a secret; **R** = required.

| Variable | R | S | Purpose / value |
|----------|---|---|-----------------|
| `NODE_ENV` | ✅ | | `production` |
| `APP_BASE_URL` | ✅ | | Public SPA origin, e.g. `https://app.example.com` (used for the OAuth return + cookie domain). |
| `OAUTH_REDIRECT_URI` | ✅ | | `https://<origin>/api/auth/google/callback` — must exactly match a Google OAuth **Authorized redirect URI**. |
| `GOOGLE_CLIENT_ID` | ✅ | | Google OAuth client ID (not secret). |
| `GOOGLE_CLIENT_SECRET` | ✅ | ✅ | Google OAuth client secret. |
| `SESSION_SIGNING_KEY` | ✅ | ✅ | ≥32 random bytes (`openssl rand -base64 48`). Rotating it invalidates all sessions. |
| `DATABASE_URL` | ✅ | ✅ | PostgreSQL connection string (use a **pooled** URL on serverless). |
| `REDIS_URL` | ✅ | ✅ | Redis connection string (`rediss://` for TLS). |
| `PORT` | | | Injected by the platform (Cloud Run). Not needed on Vercel. |
| `RATE_LIMIT_POSTS_PER_MINUTE` | | | Default `10`. |
| `SESSION_TTL_SECONDS` | | | Default `604800` (7d). |
| `FEED_CACHE_TTL_SECONDS` | | | Default `15`. |
| `DISCOVER_TTL_SECONDS` | | | Default `10800` (3h). |
| `SEARCH_TTL_SECONDS` | | | Default `3600` (1h). |
| `ITEM_TTL_SECONDS` | | | Default `86400` (24h). |
| `ITEM_STATS_TTL_SECONDS` | | | Default `60`. |
| `NYT_API_KEY` | | ✅ | Optional — NYT bestseller lists (books Discover). |
| `GOOGLE_BOOKS_API_KEY` | | ✅ | Optional — raises Google Books quota. |
| `SPOTIFY_CLIENT_ID` | | | Optional — item-page "Listen on Spotify" links. |
| `SPOTIFY_CLIENT_SECRET` | | ✅ | Optional — pairs with the client ID. |

Frontend (build-time only):

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | API base path. Leave unset → defaults to `/api` (correct when SPA + API share an origin). |

> **Generate secrets:** `openssl rand -base64 48` for `SESSION_SIGNING_KEY`. Never commit real values; `.env` is git-ignored and `.env.example` documents the names.

---

## Database migrations (both methods)

Prisma migrations are **never** run by the app itself. Apply them against the production database before (or as part of) each release:

```bash
# DATABASE_URL must point at the production DB (direct, non-pooled URL preferred for DDL)
corepack pnpm --filter @dml/backend exec prisma migrate deploy
```

- **GCP:** automated — a one-off Cloud Run **Job** (`${env}-dml-migrate`) runs `migrate deploy` inside the VPC, and the deploy workflow executes it before rolling the API. See [gcp.md](./gcp.md#5-database-migrations).
- **Vercel:** run in CI (or locally) against the Neon **direct** URL before promoting. See [vercel.md](./vercel.md#5-database-migrations).

---

## Pre-flight (applies to every deploy)

- [ ] `corepack pnpm install --frozen-lockfile`
- [ ] `corepack pnpm -r typecheck`
- [ ] `corepack pnpm -r test` (backend unit/contract + frontend) green
- [ ] `corepack pnpm -w lint` clean
- [ ] `corepack pnpm -r build` succeeds
- [ ] All required env vars/secrets provisioned for the target (table above)
- [ ] Google OAuth **Authorized redirect URI** + **Authorized JavaScript origin** updated for the production domain
- [ ] Database migrations applied (`prisma migrate deploy`)
- [ ] Smoke test: sign in with Google, post an update, open Discover, open an item page
