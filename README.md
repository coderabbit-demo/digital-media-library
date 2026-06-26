# Digital Media Library

A multi-user web app for discovering trending books, music, and audiobooks and
sharing what you're currently reading or listening to — a Goodreads-style activity
feed where the community's updates appear on the home page.

> **Status**: Early development. Built spec-first with [GitHub Spec Kit](https://github.com/github/spec-kit).
> The first feature (authentication + activity feed) is **implemented** — backend API,
> SPA, shared types, and Terraform infra are in place. Unit + contract tests pass;
> integration (Testcontainers), e2e (Playwright), and cloud deploy require a
> provisioned environment.

## What it does (vision)

- **Sign in with Google** — no passwords; a profile is created on first sign-in.
- **Activity feed** — a home-page feed of what users are currently reading/listening to.
- **Trending content** *(planned)* — trending books, music, and audiobooks from
  external providers, cached to stay fast and within API quotas.
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
| 001 | Authentication & Activity Feed | 🛠️ Implemented (in review) | [spec](specs/001-auth-activity-feed/spec.md) · [plan](specs/001-auth-activity-feed/plan.md) |

*Out of scope for 001, planned next: trending-content discovery, comments on feed updates.*

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

**Prerequisites**: Node.js 22, pnpm (via `corepack enable`), Docker (for the
integration test database / local Postgres + Redis), and a Google OAuth 2.0 client.
Copy `.env.example` to `.env` and fill in the values.

```bash
corepack enable                                   # provides pnpm
pnpm install                                      # install workspace deps
pnpm --filter @dml/backend exec prisma generate   # generate Prisma client
pnpm --filter @dml/backend exec prisma migrate dev --name init   # create schema (needs a DB)

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
