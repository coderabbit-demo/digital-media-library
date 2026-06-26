---
description: "Task list for feature 001-auth-activity-feed"
---

# Tasks: Authentication & Activity Feed

**Input**: Design documents from `/specs/001-auth-activity-feed/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: INCLUDED — the project constitution (Principle II, Test-First Quality Gates)
mandates contract + integration + unit tests authored before/with implementation.

**Tracking**: Each task maps to a **GitHub Issue**; PRs reference their issue and the
feature directory, and run CodeRabbit review before merge.

**Organization**: Tasks are grouped by user story (from spec.md) for independent
implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 (setup, foundational, and polish tasks carry no story label)

## Path Conventions

Web app monorepo (pnpm) per plan.md: `backend/`, `frontend/`, `packages/shared/`, `infra/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and toolchain

- [X] T001 Initialize pnpm monorepo at repo root (`package.json`, `pnpm-workspace.yaml` covering `backend`, `frontend`, `packages/*`)
- [X] T002 [P] Initialize backend workspace (Fastify + TypeScript) in `backend/package.json`, `backend/tsconfig.json`
- [X] T003 [P] Initialize frontend workspace (React 18 + Vite + TypeScript) in `frontend/package.json`, `frontend/vite.config.ts`
- [X] T004 [P] Initialize shared types workspace in `packages/shared/package.json`, `packages/shared/tsconfig.json`
- [X] T005 [P] Configure ESLint + Prettier across workspaces in root `.eslintrc.cjs`, `.prettierrc`
- [X] T006 [P] Configure Vitest (unit/contract/integration projects) in `vitest.config.ts`
- [X] T007 [P] Add CI workflow (install, lint, typecheck, all test gates) in `.github/workflows/ci.yml`
- [X] T008 [P] Add `.env.example` and document required env vars per quickstart.md in repo root

**Checkpoint**: Workspaces install and lint/test commands run (empty suites pass).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-cutting infrastructure every user story depends on

**⚠️ CRITICAL**: No user story work begins until this phase is complete

- [X] T009 Define Prisma schema (UserProfile, Activity, Session, MediaType enum, indexes) per data-model.md in `backend/prisma/schema.prisma`
- [X] T010 Generate initial migration and Prisma client in `backend/prisma/migrations/`
- [X] T011 [P] Implement DB connection/pool sized for Cloud Run in `backend/src/models/db.ts`
- [X] T012 [P] Implement config + secret loader (env locally, Secret Manager in cloud) in `backend/src/config/index.ts`
- [X] T013 [P] Implement structured JSON request/error logging plugin (incl. cache hit/miss fields) in `backend/src/plugins/logging.ts`
- [X] T014 [P] Implement `CacheService` abstraction + Redis implementation in `backend/src/services/cache.ts`
- [X] T015 [P] Implement Redis-backed rate-limiter plugin enforcing 10 posts/minute per user (FR-019) in `backend/src/plugins/rate-limit.ts`
- [X] T016 [P] Define shared zod schemas + DTO types (Profile, Activity, CreateActivity, FeedQuery, FeedPage) in `packages/shared/src/index.ts`
- [X] T017 Bootstrap Fastify app with global error handling and plugin registration in `backend/src/app.ts` (depends on T012, T013)
- [X] T018 Implement signed httpOnly session cookie plugin (issue/clear/verify) in `backend/src/plugins/session.ts` (depends on T017)
- [X] T019 Implement auth guard that loads the current user from the session row in `backend/src/plugins/auth.ts` (depends on T009, T018)
- [X] T020 [P] Scaffold frontend app shell, router, and API client in `frontend/src/main.tsx`, `frontend/src/services/api.ts`
- [X] T021 [P] Scaffold Terraform root (google provider, backend, variables: project_id/region/tiers/toggles) in `infra/main.tf`, `infra/variables.tf`

**Checkpoint**: App boots, DB migrates, a protected route returns 401 without a session, logging emits structured lines.

---

## Phase 3: User Story 1 - Sign in with Google and get a profile (Priority: P1) 🎯 MVP

**Goal**: Visitors sign in with Google; first sign-in auto-creates a profile, returning users reuse it, declined consent fails cleanly, and users can sign out.

**Independent Test**: Sign in on a clean system (new profile created), sign out, sign in again (same profile, no duplicate); cancel consent (no profile, clear message).

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T022 [P] [US1] Contract tests for `/auth/google/login`, `/auth/google/callback`, `/auth/logout`, `/me` vs contracts/openapi.yaml in `backend/tests/contract/auth.test.ts`
- [X] T023 [P] [US1] Integration tests (Testcontainers): first sign-in creates profile, repeat sign-in reuses (no duplicate `google_sub`), declined consent leaves unauthenticated in `backend/tests/integration/auth.test.ts`

### Implementation for User Story 1

- [X] T024 [US1] Configure Google OIDC client (discovery, Auth Code + PKCE, state) in `backend/src/services/oidc.ts`
- [X] T025 [P] [US1] Implement `ProfileService` upsert-by-`google_sub` (create on first login, refresh name/avatar) in `backend/src/services/profile.ts`
- [X] T026 [US1] Implement `GET /api/auth/google/login` (redirect to Google) and `GET /api/auth/google/callback` (validate, upsert profile, create session, set cookie, redirect) in `backend/src/api/auth.ts` (depends on T024, T025, T018)
- [X] T027 [US1] Implement `POST /api/auth/logout` (delete session row, clear cookie) in `backend/src/api/auth.ts`
- [X] T028 [US1] Implement `GET /api/me` returning the authenticated profile (401 otherwise) in `backend/src/api/me.ts` (depends on T019)
- [X] T029 [P] [US1] Build SignIn page, SignInButton, and AuthCallback handling in `frontend/src/pages/SignIn.tsx`, `frontend/src/pages/AuthCallback.tsx`
- [X] T030 [P] [US1] Add `useSession`/`useMe` hooks and sign-out action in `frontend/src/services/auth.ts`
- [X] T031 [US1] Emit structured logs for sign-in success/failure and logout in `backend/src/api/auth.ts`

**Checkpoint**: A user can sign in with Google, see their profile via `/me`, and sign out — independently demoable.

---

## Phase 4: User Story 2 - View the activity feed (Priority: P1)

**Goal**: Authenticated users see a global, most-recent-first feed (author, media type, title, relative time), with stable keyset pagination and an empty state.

**Independent Test**: Seed activities from multiple users; load the feed as an authenticated user → newest-first with all fields; page with the cursor while inserting → no duplicates/skips; empty DB → empty state; unauthenticated → prompted to sign in.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [X] T032 [P] [US2] Contract test for `GET /feed` (FeedPage shape, cursor, limit bounds) vs contracts/openapi.yaml in `backend/tests/contract/feed.test.ts`
- [X] T033 [P] [US2] Integration tests: ordering, keyset pagination stability under insert, empty state, auth-required in `backend/tests/integration/feed.test.ts`

### Implementation for User Story 2

- [X] T034 [US2] Implement `FeedService` keyset query ordered by `(created_at DESC, id DESC)` with opaque cursor encode/decode in `backend/src/services/feed.ts`
- [X] T035 [US2] Implement auth-guarded `GET /api/feed` (cursor + limit) returning FeedPage with `canDelete` per item in `backend/src/api/feed.ts` (depends on T034, T019)
- [X] T036 [US2] Add first-page feed cache (short TTL) + invalidation hook via `CacheService` in `backend/src/services/feed.ts` (depends on T014)
- [X] T037 [P] [US2] Build HomeFeed page, FeedList, ActivityCard, and empty state in `frontend/src/pages/HomeFeed.tsx`, `frontend/src/components/`
- [X] T038 [P] [US2] Implement cursor-based load-more/infinite scroll with TanStack Query in `frontend/src/services/feed.ts`
- [X] T039 [US2] Emit structured logs for feed reads incl. cache hit/miss in `backend/src/api/feed.ts`

**Checkpoint**: With seeded data, the feed renders correctly and paginates stably — US1 + US2 together form the MVP.

---

## Phase 5: User Story 3 - Post & delete a "currently reading/listening" update (Priority: P2)

**Goal**: Authenticated users post updates (media type + title, optional author) that appear at the top of the feed and are visible to others; users can delete only their own; validation, plain-text safety, and rate limiting enforced.

**Independent Test**: Post an update → appears first, attributed to you; missing field → 400; another user sees it with `canDelete=false`; cross-user delete → 403; own delete → 204 and gone; HTML in title renders literally; rapid posting → 429.

### Tests for User Story 3 ⚠️ (write first, must fail)

- [X] T040 [P] [US3] Contract tests for `POST /activities` and `DELETE /activities/{id}` vs contracts/openapi.yaml in `backend/tests/contract/activities.test.ts`
- [X] T041 [P] [US3] Integration tests: post appears in feed, validation 400, cross-user delete 403, own delete 204, rate limit 429 at the 11th post within a minute (FR-019), plain-text storage in `backend/tests/integration/activities.test.ts`

### Implementation for User Story 3

- [X] T042 [US3] Implement `ActivityService.create` and `ActivityService.delete` with ownership check (`id AND user_id`) in `backend/src/services/activity.ts`
- [X] T043 [US3] Implement `POST /api/activities` (zod validation, rate limit, plain-text, cache invalidation) in `backend/src/api/activities.ts` (depends on T042, T016, T015, T036)
- [X] T044 [US3] Implement `DELETE /api/activities/{id}` (404 vs 403 vs 204, cache invalidation) in `backend/src/api/activities.ts` (depends on T042, T036)
- [X] T045 [P] [US3] Build PostUpdateForm with optimistic insert and a delete control on own cards in `frontend/src/components/PostUpdateForm.tsx`
- [X] T046 [US3] Emit structured logs for post/delete operations in `backend/src/api/activities.ts`

**Checkpoint**: All three stories function independently; the full feature is exercisable end-to-end.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, infra completion, and validation across stories

- [X] T047 [P] Unit tests for services and zod validation in `backend/tests/unit/`, `packages/shared/tests/`
- [X] T048 Playwright e2e smoke (sign-in → post → see-in-feed) with timing assertions for post-visible <3s (SC-004) and initial feed <2s (SC-005) in `frontend/tests/e2e/feed.spec.ts`
- [X] T049 [P] Complete Terraform resources (Cloud Run, CloudSQL private IP, Serverless VPC connector, Memorystore Redis, Cloud Storage + HTTPS LB + Cloud CDN, Secret Manager, runtime IAM SA) in `infra/main.tf`, `infra/iam.tf`, `infra/secrets.tf`
- [X] T050 [P] Add Cloud Logging sinks + log retention bucket in `infra/logging.tf`
- [X] T051 [P] Add backend Dockerfile + Artifact Registry build/push config in `backend/Dockerfile`, `.github/workflows/`
- [X] T052 [P] Add SPA build + deploy-to-bucket step in `frontend/` and CI
- [X] T053 Security hardening pass: cookie flags (httpOnly/Secure/SameSite), security headers, same-origin CORS in `backend/src/app.ts`
- [X] T054 [P] Update README.md (Features table → 001 In progress/Done; Getting started) and AGENTS.md (stack/setup) per current state
- [ ] T055 Run quickstart.md validation scenarios 1–11 (local, then post-`terraform apply`)
- [X] T056 [P] Load test at ~100 concurrent active users verifying feed p95 stays within the 2s threshold (SC-005/SC-007), with a seeded feed, in `backend/tests/load/feed-load.js` (k6 or equivalent)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**.
- **User Stories (Phase 3–5)**: All depend on Foundational. US1 and US2 are both P1; US3 (P2) builds on the feed.
- **Polish (Phase 6)**: Depends on the targeted user stories being complete.

### User Story Dependencies

- **US1 (P1, auth)**: After Foundational. No dependency on other stories. Produces a valid session.
- **US2 (P1, feed)**: After Foundational. Independently testable with seeded data; in a live demo, sign-in (US1) provides the session.
- **US3 (P2, post/delete)**: After Foundational. Reuses the feed cache invalidation (T036) and shared schemas; independently testable.

### Within Each User Story

- Tests written first and failing → models/services → endpoints → frontend → logging.
- Services before endpoints; endpoints before the UI that calls them.

### Parallel Opportunities

- Setup: T002–T008 in parallel after T001.
- Foundational: T011–T016 in parallel; then T017 → T018 → T019 in sequence (shared files / ordering); T020, T021 in parallel.
- Across stories: once Foundational is done, US1, US2, US3 can be staffed in parallel; within a story, all `[P]` tests run together and frontend `[P]` tasks run alongside backend ones.

---

## Parallel Example: User Story 1

```bash
# Tests first (parallel):
Task: "Contract tests for auth endpoints in backend/tests/contract/auth.test.ts"
Task: "Integration tests for sign-in/profile in backend/tests/integration/auth.test.ts"

# Then parallel implementation where files differ:
Task: "ProfileService upsert in backend/src/services/profile.ts"
Task: "SignIn page + AuthCallback in frontend/src/pages/"
Task: "useSession/useMe hooks in frontend/src/services/auth.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1: Setup → 2. Phase 2: Foundational → 3. Phase 3: US1 (auth) → 4. Phase 4: US2 (feed).
5. **STOP and VALIDATE**: sign in, see a (seeded) feed. Deploy/demo the MVP.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → test independently → demo (sign-in works).
3. US2 → test independently → demo (feed renders, paginates).
4. US3 → test independently → demo (posting/deleting drives the feed).
5. Polish → infra via Terraform, e2e, hardening, quickstart validation.

### Parallel Team Strategy

After Foundational: Dev A → US1, Dev B → US2 (seeded data), Dev C → starts US3 services. Integrate via the shared `packages/shared` contracts.

---

## Notes

- `[P]` = different files, no incomplete-task dependency.
- Each task should map to a GitHub Issue; commit per task or logical group; PRs run CodeRabbit and keep the suite green.
- Verify tests fail before implementing (Principle II).
- Stop at any checkpoint to validate a story independently.
