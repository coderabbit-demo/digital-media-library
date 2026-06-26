# Digital Media Library

A multi-user web app for discovering trending books, music, and audiobooks and
sharing what you're currently reading or listening to — a Goodreads-style activity
feed where the community's updates appear on the home page.

> **Status**: Early development. Built spec-first with [GitHub Spec Kit](https://github.com/github/spec-kit).
> The first feature (authentication + activity feed) is fully specified and planned;
> implementation has not started yet.

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
| 001 | Authentication & Activity Feed | 📋 Planned (spec + plan complete) | [spec](specs/001-auth-activity-feed/spec.md) · [plan](specs/001-auth-activity-feed/plan.md) |

*Out of scope for 001, planned next: trending-content discovery, comments on feed updates.*

## Repository layout

```text
backend/    # Fastify API (Cloud Run)          — created during implementation
frontend/   # React + Vite SPA                 — created during implementation
packages/   # shared types/schemas             — created during implementation
infra/      # Terraform (GCP resources)        — created during implementation
specs/      # Spec Kit feature specs & plans
.specify/   # Spec Kit config, templates, constitution
```

> The `backend/`, `frontend/`, `packages/`, and `infra/` directories are defined in
> the plan and will appear once feature 001 implementation begins.

## Getting started

> ⚠️ Application code does not exist yet. Until implementation begins, the
> authoritative setup/run/validation steps live in the feature quickstart:
> [specs/001-auth-activity-feed/quickstart.md](specs/001-auth-activity-feed/quickstart.md).

Once `backend/`, `frontend/`, and `infra/` are scaffolded, this section will document:

```bash
pnpm install                 # install workspace deps
pnpm dev                     # run SPA + API locally
pnpm test                    # unit + contract + integration
cd infra && terraform apply  # provision GCP resources
```

(See the quickstart for the current, detailed prerequisites and environment variables.)

## Contributing

See [AGENTS.md](AGENTS.md) for conventions, the Spec Kit workflow, and guidance for
both human and AI contributors.

---

*This README is maintained as the project evolves — each new feature and setup change
is reflected in the Features table and Getting started section.*
