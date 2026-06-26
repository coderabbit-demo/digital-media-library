# Implementation Plan: Authentication & Activity Feed

**Branch**: `001-auth-activity-feed` | **Date**: 2026-06-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-auth-activity-feed/spec.md`

## Summary

Deliver Google-account sign-in/registration with auto-created profiles and a global,
most-recent-first activity feed where authenticated users post and delete
"currently reading/listening" updates (books, music, audiobooks). The system is a
TypeScript SPA backed by a stateless API on Cloud Run, with CloudSQL (PostgreSQL)
as the source of truth, server-side sessions referenced by a signed httpOnly
cookie, and a cache abstraction (Memorystore/Redis) ready to front external
providers in later features. All GCP resources are provisioned via Terraform in
`infra/` with Cloud Logging enabled. Region: `us-central1`; sized for ~100
concurrent users with parameterized resources for easy scale-up.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22 LTS (backend); TypeScript 5.x on the frontend

**Primary Dependencies**: Backend — Fastify (HTTP), Prisma (PostgreSQL ORM/migrations), `openid-client` (Google OIDC), `zod` (validation). Frontend — React 18 + Vite, TanStack Query (data fetching), React Router. Shared — a `packages/shared` workspace for request/response types.

**Storage**: CloudSQL for PostgreSQL (single source of truth: profiles, activities, sessions). Memorystore for Redis as the cache layer (feed page cache now; provider-response cache later).

**Testing**: Vitest (unit), Fastify `inject` + Testcontainers-PostgreSQL (contract/integration), Playwright (end-to-end smoke for the auth → feed flow).

**Target Platform**: Modern desktop and mobile web browsers (SPA). Backend runs as a container on Google Cloud Run (Linux).

**Project Type**: Web application (frontend SPA + backend API + Terraform infra), pnpm monorepo.

**Performance Goals**: Initial feed page returns within 2s under normal load (SC-005); a posted update appears at the top of the author's feed within 3s (SC-004); sign-in success ≥95% of completed-consent attempts (SC-002); feed latency holds within the 2s threshold at ~100 concurrent active users (SC-007).

**Constraints**: Stateless API (any request to any Cloud Run instance); no in-process session state; secrets only from Secret Manager; TLS everywhere; per-request authorization on mutations; user text rendered as plain text only; per-user post rate limiting of **10 posts/minute** (FR-019), enforced via Redis counters so the limit holds across instances.

**Scale/Scope**: Launch target ~100 concurrent active users in `us-central1`. Resource sizing minimal (smallest CloudSQL tier, Cloud Run min-instances 0–1, smallest Memorystore Basic tier) and parameterized via Terraform variables for scale-up.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Constitution v1.3.0:

| Principle / Constraint | Status | How this plan complies |
|------------------------|--------|------------------------|
| I. Spec-Driven Development | ✅ Pass | Built from approved `spec.md`; this plan precedes any code; no `NEEDS CLARIFICATION` remain after Phase 0. |
| II. Test-First Quality Gates | ✅ Pass | Plan mandates contract tests per endpoint, integration tests for auth/feed flows, and unit tests for business logic, authored before implementation; CI-blocking. |
| III. Resilient Integrations & Aggressive Caching | ✅ Pass (forward-looking) | This feature integrates no external content providers (trending is out of scope), so there are none to abstract yet. A `CacheService` abstraction and Memorystore are introduced now so the boundary and caching pattern exist before providers land. |
| IV. Security & Privacy by Default | ✅ Pass | Google OIDC only (no passwords); secrets in Secret Manager; TLS via Google-managed cert; signed httpOnly+Secure session cookie; per-request authz on delete; minimal PII (id, display name, avatar URL). |
| V. Cloud-Native, Cost-Aware Operations | ✅ Pass | Stateless API; session/state only in CloudSQL and Redis; Prisma connection pooling sized for Cloud Run; structured JSON logs incl. cache hit/miss; smallest resource tiers. |
| Constraint: Infrastructure as Code (Terraform) | ✅ Pass | All GCP resources defined in `infra/` Terraform; no manual provisioning. |
| Constraint: Logging & observability (Cloud Logging) | ✅ Pass | Cloud Logging enabled for Cloud Run and infra via Terraform; structured app logs; log retention configured. |
| Workflow: GitHub Issues + CodeRabbit | ✅ Pass | Tasks tracked as GitHub Issues referencing this feature dir; PRs run CodeRabbit before merge. |

**Result**: PASS — no violations. Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-auth-activity-feed/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── openapi.yaml
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/          # Prisma schema + generated client wrapper
│   ├── services/        # auth, profile, feed, activity, cache (CacheService abstraction)
│   ├── api/             # Fastify routes: auth, me, feed, activities
│   ├── plugins/         # session cookie, auth guard, rate limiter, request logging
│   └── config/          # env/secret loading
└── tests/
    ├── contract/        # one suite per endpoint (request/response schema)
    ├── integration/     # auth flow, feed pagination, post/delete authz
    └── unit/            # services, validation

frontend/
├── src/
│   ├── components/      # FeedList, ActivityCard, PostUpdateForm, SignInButton
│   ├── pages/           # HomeFeed, SignIn, AuthCallback
│   └── services/        # API client, auth/session hooks (TanStack Query)
└── tests/               # component + Playwright e2e

packages/
└── shared/              # shared request/response types and zod schemas

infra/                   # Terraform (Google provider)
├── main.tf              # Cloud Run, CloudSQL, Memorystore, VPC connector, LB+CDN, Artifact Registry
├── iam.tf               # runtime service account + least-privilege bindings
├── secrets.tf           # Secret Manager entries (OAuth secret, DB password, session key)
├── logging.tf           # Cloud Logging sinks + retention
├── variables.tf         # region, tiers, min/max instances, toggles
└── outputs.tf
```

**Structure Decision**: Web application (Option 2) realized as a pnpm monorepo with
`backend/`, `frontend/`, a shared types `packages/shared`, and a dedicated `infra/`
Terraform root. This separates the stateless API (Cloud Run) from the static SPA
(served via Cloud Storage + Cloud CDN behind a single HTTPS load balancer that
path-routes `/api/*` to the API) and keeps all infrastructure declarative.

## Complexity Tracking

> No constitutional violations — this section is intentionally empty.
