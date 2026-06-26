# Phase 0 Research: Authentication & Activity Feed

All Technical Context unknowns are resolved below. Each decision records what was
chosen, why, and the alternatives considered.

## 1. Application stack (language & frameworks)

- **Decision**: TypeScript end-to-end in a pnpm monorepo — React 18 + Vite SPA
  (frontend), Fastify on Node.js 22 LTS (backend), shared types in
  `packages/shared`.
- **Rationale**: One language and toolchain across frontend/backend lowers
  cognitive load and lets request/response types be shared and validated with the
  same `zod` schemas. Fastify is lightweight, fast to cold-start (good for Cloud
  Run), and has first-class schema validation. Vite gives a fast SPA build emitted
  as static assets.
- **Alternatives considered**: Python FastAPI backend (strong option, but splits
  the toolchain and loses shared types with the SPA); Next.js full-stack (SSR adds
  server runtime complexity the spec doesn't need — an SPA is sufficient).

## 2. Authentication: Google OIDC + session strategy

- **Decision**: OAuth 2.0 Authorization Code flow with PKCE against Google's OIDC
  endpoints via `openid-client`. On callback, upsert the profile keyed by the
  Google `sub` claim, then create a **server-side session row** in PostgreSQL and
  set its opaque id in a **signed, httpOnly, Secure, SameSite=Lax cookie**.
- **Rationale**: Server-side sessions are trivially revocable (sign-out, account
  deletion) and keep no secret state in the browser. The session table lives in
  CloudSQL — shared across all Cloud Run instances — so the API stays stateless per
  Principle V. `sub` is Google's stable identifier and the correct dedup key for
  Principle IV / FR-003 (no duplicate profiles), rather than email which can change.
- **Alternatives considered**: Stateless JWT session cookies (hard to revoke;
  rejected for a social app handling user content); Redis-backed sessions (works,
  but adds a Redis dependency to the auth hot path — Postgres is sufficient at this
  scale and Redis stays focused on caching).

## 3. Caching layer

- **Decision**: Define a `CacheService` interface now and back it with **Memorystore
  for Redis (Basic tier, smallest)**. In this feature it caches the global feed's
  first page with a short TTL and is invalidated on new posts/deletes. Provisioning
  is behind a Terraform variable (`enable_redis`, default true).
- **Rationale**: Principle III makes caching and a provider-access boundary
  architectural. Although this feature has no external providers, introducing the
  abstraction and the Redis instance now means trending integration later only adds
  an implementation behind an existing interface. The global feed is read-heavy and
  identical across users, so first-page caching directly supports SC-005.
- **Alternatives considered**: Defer Redis entirely (cheaper, but reintroduces the
  abstraction work later and leaves SC-005 to the DB alone); in-process per-instance
  cache (violates statelessness — invalidation can't be coordinated across
  instances).

## 4. SPA hosting & routing

- **Decision**: Serve the built SPA from a **Cloud Storage bucket fronted by a
  global external HTTPS Load Balancer with Cloud CDN**. The same load balancer
  path-routes `/api/*` to the Cloud Run API via a serverless NEG, giving one origin
  and a Google-managed TLS certificate.
- **Rationale**: Single domain removes cross-site cookie complexity (the session
  cookie is first-party), CDN offloads static delivery cheaply, and TLS is managed.
  All of it is Terraform-expressible.
- **Alternatives considered**: Firebase Hosting (simplest, but adds a non-Terraform
  control plane); serving static files from the Cloud Run API (couples SPA delivery
  to API scaling and wastes API compute on static assets).

## 5. Database access & migrations

- **Decision**: **Prisma** for schema, typed queries, and migrations against
  CloudSQL PostgreSQL. Connect from Cloud Run over **private IP via a Serverless VPC
  Access connector**, using a small connection pool sized to Cloud Run concurrency.
- **Rationale**: Prisma gives type safety aligned with the TypeScript stack and a
  first-class migration workflow. Private IP keeps the database off the public
  internet (Principle IV). Small pools prevent connection exhaustion when many
  Cloud Run instances scale out (Principle V).
- **Alternatives considered**: Cloud SQL Auth Proxy sidecar over public IP (more
  moving parts than the built-in connector + private IP); raw `pg` + hand-written
  SQL (loses type safety and migration tooling).

## 6. Feed pagination

- **Decision**: **Keyset (cursor) pagination** ordered by `(created_at DESC, id
  DESC)`, cursor encoding the last seen `(created_at, id)`.
- **Rationale**: Stable under inserts (new posts don't shift pages) — directly
  satisfies FR-011 and the "no duplicates / no skips" edge case. Efficient with an
  index on `(created_at DESC, id DESC)`.
- **Alternatives considered**: OFFSET/LIMIT pagination (simpler but drifts and
  duplicates rows as new activity arrives at the head).

## 7. Input safety, validation & rate limiting

- **Decision**: Validate all request bodies with `zod` schemas shared from
  `packages/shared`; enforce length limits on title/author; store and return user
  text as plain text (never rendered as HTML). Apply per-user post **rate limiting**
  via a Fastify plugin backed by Redis.
- **Rationale**: Satisfies FR-014 (validation), FR-018 (plain-text only — defends
  against script injection in the feed), and FR-019 (anti-spam). Redis-backed limit
  counters work correctly across stateless instances.
- **Alternatives considered**: Client-only validation (insufficient — server must
  enforce); in-memory rate limiting (per-instance, bypassable when scaled out).

## 8. GCP infrastructure (Terraform) & logging

- **Decision**: Terraform root in `infra/` using the `google` provider, region
  `us-central1`. Resources: Artifact Registry (images), Cloud Run service (API),
  CloudSQL PostgreSQL (smallest tier, private IP), Serverless VPC Access connector,
  Memorystore Redis (Basic, smallest), Cloud Storage + HTTPS LB + Cloud CDN (SPA),
  Secret Manager (OAuth client secret, DB password, session signing key), a
  least-privilege runtime service account, and **Cloud Logging** sinks with a
  retention bucket. Tiers, min/max instances, and region are Terraform variables.
- **Rationale**: Implements the constitution's IaC and logging constraints; smallest
  tiers meet the ~100-concurrent target while remaining cheap; parameterization
  makes scale-up a variable change rather than a rewrite.
- **Alternatives considered**: gcloud scripts / console (prohibited by the
  constitution); Config Connector / Pulumi (Terraform is the chosen standard).
- **Cost note**: Memorystore Basic and a min-instance>0 Cloud Run config carry
  standing cost; both are toggle/variable-controlled so they can be tuned down for
  demo environments.

## 9. Testing strategy

- **Decision**: Vitest for unit tests; contract tests per endpoint via Fastify
  `inject` asserting request/response against the shared schemas; integration tests
  over a real PostgreSQL through **Testcontainers** covering the auth callback,
  feed pagination, and post/delete authorization; one Playwright e2e smoke for
  sign-in → post → see-in-feed. Google OIDC is stubbed at the OIDC-client boundary
  in tests.
- **Rationale**: Honors Principle II (test-first, contract + integration + unit) and
  exercises the multi-user authorization paths (FR-017) that are highest risk.
- **Alternatives considered**: Mocking the database (faster but misses keyset
  pagination and constraint behavior that integration tests must prove).

## Resolved unknowns

No `NEEDS CLARIFICATION` markers remain. Region (`us-central1`) and launch scale
(~100 concurrent) were supplied; all stack, hosting, and infra choices are decided
above and reflected in `plan.md`.
