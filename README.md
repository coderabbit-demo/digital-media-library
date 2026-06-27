# Digital Media Library

A multi-user web app for discovering trending books, music, audiobooks, and
podcasts and sharing what you're currently reading or listening to — a
Goodreads-style activity feed where the community's updates appear on the home page.

> **Status**: Early development. Built spec-first with [GitHub Spec Kit](https://github.com/github/spec-kit).
> The first feature (authentication + activity feed) is **implemented** — backend API,
> SPA, shared types, and Terraform infra are in place. Unit + contract tests pass;
> integration (Testcontainers), e2e (Playwright), and cloud deploy require a
> provisioned environment.

## What it does (vision)

- **Sign in with Google** — no passwords; a profile is created on first sign-in.
- **Activity feed** — a home-page feed of what users are currently reading/listening to.
- **Trending content** *(planned)* — trending books, music, audiobooks, and
  podcasts from external providers, cached to stay fast and within API quotas.
- **Comments** *(planned)* — discussion on feed updates.

## Architecture

| Layer | Choice |
|-------|--------|
| Frontend | React + Vite single-page app (SPA) |
| Backend | Stateless Fastify (Node.js 22 / TypeScript) API on **Google Cloud Run** |
| Database | **CloudSQL for PostgreSQL** (source of truth) via Prisma |
| Cache | **Memorystore for Redis** (feed cache now; external-provider cache later) |
| Auth | **Google OAuth 2.0 / OIDC**, server-side sessions via signed httpOnly cookie |
| Hosting | SPA on Cloud Storage + Cloud CDN behind an HTTPS load balancer (single origin) |
| Infra | **Terraform** in [`infra/`](infra/) — region `us-central1` |
| Logging | **Cloud Logging** for all services and infrastructure |

The project's non-negotiable principles live in the
[constitution](.specify/memory/constitution.md).

## Process & tooling

- **Spec Kit** drives development: constitution → specify → plan → tasks → implement.
  Feature specs live under [`specs/`](specs/).
- **GitHub Issues** track requirements and tasks.
- **CodeRabbit** runs automated code review on every pull request.

## Features

| # | Feature | Status | Spec |
|---|---------|--------|------|
| 001 | Authentication & Activity Feed | ✅ Merged | [spec](specs/001-auth-activity-feed/spec.md) · [plan](specs/001-auth-activity-feed/plan.md) |
| 002 | App shell, auth gate & three-column home | ✅ Merged | [spec](specs/002-app-shell-home/spec.md) · [plan](specs/002-app-shell-home/plan.md) |
| 003 | Discover (trending by category) | ✅ Merged | [spec](specs/003-discover/spec.md) · [plan](specs/003-discover/plan.md) |
| 004 | Search & recommendations | ✅ Merged | [spec](specs/004-search-recommend/spec.md) · [plan](specs/004-search-recommend/plan.md) |
| 005 | Wishlist (private, all-media, filtered) | 🛠️ Implemented (in review) | [spec](specs/005-wishlist/spec.md) · [plan](specs/005-wishlist/plan.md) |

*Content-discovery roadmap: 003 Discover (trending) → 004 Search & recommendations → 005 Wishlist → 006 Conversations (replies). Built on the provider-abstraction + cache layer introduced in 003. Search is provider-backed + cached: books via Google Books, music/audiobooks/podcasts via the keyless iTunes Search API.*

## Repository layout

```text
backend/    # Fastify API (Cloud Run) — Prisma, OIDC, sessions, feed, activities
frontend/   # React + Vite SPA — TanStack Query, sign-in, feed, post/delete
packages/   # @dml/shared — types + zod schemas shared across API and UI
infra/      # Terraform (GCP resources)
specs/      # Spec Kit feature specs & plans
.specify/   # Spec Kit config, templates, constitution
```

## Getting started

**Prerequisites**: Node.js 22, pnpm (via `corepack enable`), Docker, and a Google
OAuth 2.0 client. The backend reads `backend/.env` — copy `.env.example` there and
fill in `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `SESSION_SIGNING_KEY`
(generate with `openssl rand -hex 32`); the DB/Redis URLs already match the compose
file below.

```bash
corepack enable                                   # provides pnpm
docker compose up -d                              # local Postgres + Redis
cp .env.example backend/.env                      # then edit backend/.env
pnpm install                                      # install deps (runs prisma generate)
pnpm --filter @dml/backend exec prisma migrate dev --name init   # create schema

pnpm dev          # run API (:8080) + SPA (:5173, proxies /api)

pnpm lint         # eslint
pnpm typecheck    # tsc across workspaces
pnpm build        # build all packages
pnpm test:unit        # unit tests
pnpm test:contract    # API contract tests
pnpm test:integration # integration tests (requires Docker)
pnpm test:e2e         # Playwright e2e (run `pnpm --filter @dml/frontend exec playwright install` first)

cd infra && terraform init && terraform apply -var project_id=<PROJECT>  # provision GCP
```

See [specs/001-auth-activity-feed/quickstart.md](specs/001-auth-activity-feed/quickstart.md)
for detailed validation scenarios and environment variables, and
[infra/README.md](infra/README.md) for cloud provisioning notes.

## Contributing

See [AGENTS.md](AGENTS.md) for conventions, the Spec Kit workflow, and guidance for
both human and AI contributors.

---

*This README is maintained as the project evolves — each new feature and setup change
is reflected in the Features table and Getting started section.*
