---
description: "Task list for feature 003-discover"
---

# Tasks: Discover (Trending by Category)

**Input**: Design documents from `/specs/003-discover/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: INCLUDED — the constitution (Principle II) mandates contract + integration + unit tests authored before/with implementation.

**Tracking**: Each task maps to a GitHub Issue; PRs reference their issue and run CodeRabbit before merge.

**Builds on**: 001 (auth, posting, profiles), 002 (shell/home, compose overlay, MD3). **Introduces the provider-abstraction + Redis cache + stale-on-failure layer** (Principle III). No new DB tables.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different files, no dependency on an incomplete task → can run in parallel.
- **[Story]**: US1 (Discover trending) / US2 (start activity from a Discover item). Setup/Foundational/Polish carry no story label.

## Path Conventions

Existing pnpm monorepo: `backend/`, `frontend/`, `packages/shared/`, `infra/`.

---

## Phase 1: Setup

- [X] T001 [P] Add `TrendingItemDTO`, `DiscoverPageDTO`, and route-segment↔`MediaType` category helpers to `packages/shared/src/index.ts`
- [X] T002 [P] Add provider config (`NYT_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `DISCOVER_TTL_SECONDS`) to `backend/src/config/index.ts` and `.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The provider-abstraction boundary + caching/resilience service every Discover view depends on

**⚠️ CRITICAL**: No user-story work begins until this phase is complete

- [X] T003 Define the `ContentProvider` interface and normalized `TrendingItem` type in `backend/src/providers/content-provider.ts` (no provider SDK/URL imported outside `providers/`)
- [X] T004 [P] Implement an HTTP fetch helper with per-request timeout + JSON parsing for provider calls in `backend/src/providers/http.ts`
- [X] T005 Implement `TrendingService` (cache-aside: fresh-key TTL serve, lazy refresh, last-known-good stale fallback, failure cooldown) over the existing Redis `CacheService` in `backend/src/services/discover.ts` (depends on T003)
- [X] T006 Add `discover`/provider registry to the DI context types in `backend/src/context.ts`

**Checkpoint**: The service can serve/refresh/fall-back against an injected fake provider (covered by tests in US1).

---

## Phase 3: User Story 1 - Discover trending content by category (Priority: P1) 🎯 MVP

**Goal**: Each category (Books/Music/Audiobooks) Discover view shows trending items from its provider, served from cache (fresh → lazy refresh → stale fallback → empty), in ≤2s.

**Independent Test**: Open Books/Music/Audiobooks → Discover and see category-appropriate trending items; second load is a cache hit; with the provider down, the last-known-good results render with a "may be out of date" banner; cold failure shows a clear unavailable state.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T007 [P] [US1] Contract test for `GET /api/discover/{category}` (DiscoverPage shape, `stale` flag, unknown-category 400, 401 unauth) in `backend/tests/contract/discover.test.ts`
- [X] T008 [P] [US1] Integration test: cache hit (no 2nd provider call), lazy refresh after TTL, stale fallback on provider failure, empty state on cold failure — with a fake provider + cache — in `backend/tests/integration/discover.test.ts`
- [X] T009 [P] [US1] Unit tests for each provider adapter using mocked HTTP (undici MockAgent): normalization, missing fields, error handling — in `backend/tests/unit/providers.test.ts`
- [X] T010 [P] [US1] Unit tests for `TrendingService` cache/stale/cooldown logic in `backend/tests/unit/discover-service.test.ts`
- [X] T011 [P] [US1] Frontend component tests: Discover list renders items, stale banner shows when `stale`, empty/unavailable state — in `frontend/tests/Discover.test.tsx`

### Implementation for User Story 1

- [X] T012 [P] [US1] Implement `NytBooksProvider` (bestseller lists → normalized items) in `backend/src/providers/nyt-books.ts`
- [X] T013 [P] [US1] Implement `SpotifyMusicProvider` (client-credentials token cached in Redis; new releases/featured → items) in `backend/src/providers/spotify-music.ts`
- [X] T014 [P] [US1] Implement `AppleAudiobookProvider` (iTunes RSS/Search → items; no key) in `backend/src/providers/apple-audiobooks.ts`
- [X] T015 [US1] Build the category→provider registry and wire `TrendingService` + providers into `backend/src/app.ts` and `backend/src/context.ts` (depends on T005, T012–T014)
- [X] T016 [US1] Implement auth-guarded `GET /api/discover/{category}` (validate category/limit, return DiscoverPage, log provider/cache/stale) in `backend/src/api/discover.ts` (depends on T015)
- [X] T017 [P] [US1] Add `useDiscover(category)` query in `frontend/src/services/discover.ts`
- [X] T018 [P] [US1] Build `Discover` page + `DiscoverList`, `DiscoverItemCard`, `StaleBanner` (cover/title/creator, empty/unavailable states) in `frontend/src/pages/Discover.tsx` and `frontend/src/components/`
- [X] T019 [US1] Replace the `CategoryPlaceholder` routes with `Discover` for `/books`, `/music`, `/audiobooks` in `frontend/src/App.tsx`

**Checkpoint**: Discover works per category with caching + stale fallback, independently demoable.

---

## Phase 4: User Story 2 - Start an activity from a discovered item (Priority: P2)

**Goal**: From a Discover item, the user starts a "currently reading/listening" activity pre-filled with the item's details, reusing the feature-001 posting flow + 002 compose overlay.

**Independent Test**: From a Discover item choose "I'm reading/listening to this"; the compose overlay opens pre-filled with media type/title/creator; submitting posts it and it appears in the feed.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [X] T020 [P] [US2] Frontend test: a Discover item's start-activity action opens the compose overlay pre-filled with the item's media type/title/creator, in `frontend/tests/DiscoverStartActivity.test.tsx`

### Implementation for User Story 2

- [X] T021 [US2] Extend `PostUpdateForm`/`ComposeDialog` to accept optional initial values (mediaType/title/itemAuthor) for pre-fill in `frontend/src/components/PostUpdateForm.tsx` and `frontend/src/components/ComposeDialog.tsx`
- [X] T022 [US2] Add an "I'm reading/listening to this" action on `DiscoverItemCard` that opens the pre-filled compose overlay in `frontend/src/components/DiscoverItemCard.tsx` (+ wiring in `frontend/src/pages/Discover.tsx`)

**Checkpoint**: Discovery feeds directly into posting.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T023 [P] Terraform: add Secret Manager secrets (`NYT_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`), grant the runtime SA accessor, and inject them into the Cloud Run service env, in `infra/secrets.tf` + `infra/main.tf`
- [X] T024 [P] Verify structured logging covers provider name/latency/outcome and cache hit/miss/stale (Principle V) in `backend/src/services/discover.ts` / `backend/src/api/discover.ts`
- [X] T025 [P] Update `README.md` (Features table → 003) and `AGENTS.md` if stack/setup notes changed
- [ ] T026 Run quickstart.md validation scenarios 1–8 (per-category Discover, cache hit, stale fallback, cold empty, plain-text, no-direct-calls, start-activity, quota safety)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup — the abstraction + service block both stories.
- **US1 (Phase 3)**: after Foundational. **US2 (Phase 4)**: after US1 (needs Discover items + the compose overlay to prefill).
- **Polish (Phase 5)**: after the targeted stories (Terraform secrets can proceed in parallel once config names from T002 are fixed).

### Within Each User Story

- Tests first (must fail) → implementation. Backend: providers → registry/wiring → endpoint. Frontend: query → components → route wiring.

### Parallel Opportunities

- Setup: T001, T002 together.
- Foundational: T004 alongside T003; T005 after T003.
- US1 tests: T007–T011 together. The three provider adapters T012–T014 are independent → parallel. Frontend T017/T018 parallel with backend.
- Polish: T023/T024/T025 parallel.

---

## Parallel Example: User Story 1

```bash
# Tests first (parallel):
Task: "Contract test GET /api/discover/{category} in backend/tests/contract/discover.test.ts"
Task: "Integration cache/stale test in backend/tests/integration/discover.test.ts"
Task: "Provider adapter unit tests in backend/tests/unit/providers.test.ts"
Task: "Discover component tests in frontend/tests/Discover.test.tsx"

# Then the three provider adapters in parallel:
Task: "NytBooksProvider in backend/src/providers/nyt-books.ts"
Task: "SpotifyMusicProvider in backend/src/providers/spotify-music.ts"
Task: "AppleAudiobookProvider in backend/src/providers/apple-audiobooks.ts"
```

---

## Implementation Strategy

### MVP (US1)

1. Setup → 2. Foundational → 3. US1 (Discover for all three categories with caching + stale fallback).
4. **STOP and VALIDATE**: cache hit, stale fallback, ≤2s. Deploy/demo.

### Incremental Delivery

- Setup + Foundational → abstraction + cache service ready.
- US1 → trending Discover (demo per category).
- US2 → start-activity-from-item.
- Polish → Terraform secrets, observability, docs, quickstart validation.

---

## Notes

- Each task maps to a GitHub Issue; commit per task or logical group; PRs run CodeRabbit and keep the suite green.
- Verify tests fail before implementing (Principle II). Unit/integration use mocked HTTP + a fake provider, so CI passes without real provider keys; full local/cloud validation needs `NYT_API_KEY` + `SPOTIFY_*`.
- No module outside `backend/src/providers/` may import a provider SDK/host (Principle III) — enforced by the no-direct-calls quickstart check.
