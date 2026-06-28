# Tasks: Item Detail Page

**Feature**: 007-item-page | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Tests are included (Constitution II — Test-First). Each test task precedes the implementation it covers and must fail first.

**MVP** = Phase 1 + Phase 2 + Phase 3 (US1): a deep-linkable item page rendering provider-backed detail, reachable from every list, with Search back-nav preserved.

---

## Phase 1: Setup

- [x] T001 Add `ITEM_TTL_SECONDS` (default 86400) and `ITEM_STATS_TTL_SECONDS` (default 60) to backend config in `backend/src/config/index.ts`, with env parsing + defaults matching existing config style.

## Phase 2: Foundational (blocking prerequisites)

- [x] T002 [P] Add shared DTOs in `packages/shared/src/index.ts`: `ItemDetailDTO`, `ShelfCountsDTO`, `ItemActivityDTO`, `ItemStatsDTO`, `ItemPageDTO` (per data-model.md), plus a `itemPathFor(mediaType, providerId)` helper that builds `/item/:mediaType/:providerId` with encoding.
- [x] T003 [P] Define `ItemProvider` boundary in `backend/src/providers/item-provider.ts`: `getItem(providerId: string): Promise<ItemDetail | null>` and the normalized `ItemDetail` value object (mediaType, providerId, title, creator, coverUrl, description, genres[], providerUrl, series).
- [x] T004 Add Prisma `@@index([mediaType, providerId])` to `Rating`, `LibraryItem`, and `Activity` in `backend/prisma/schema.prisma` (if absent) and create the migration; keeps stats queries bounded (Principle V). Index-only, no data change.

## Phase 3: User Story 1 — View an item detail page (P1)

**Goal**: A deep-linkable `/item/:mediaType/:providerId` page renders provider-backed detail from any list; Search results survive back-navigation.

**Independent test**: Open an item from a Discover card and via a cold URL; confirm cover/title/creator/badge/expandable synopsis/genres render, unknown id → not-found, and back-from-Search keeps results.

### Tests (write first, must fail)

- [x] T005 [P] [US1] Contract test `backend/tests/contract/items.test.ts`: `GET /api/items/:mediaType/:providerId` returns `ItemPageDTO` shape (item + detailAvailable + stats), 400 on bad mediaType, 401 unauthenticated, 404 when unknown to provider and DB, and `detailAvailable:false` (200) when the provider lookup throws but item is otherwise known.
- [x] T006 [P] [US1] Component test `frontend/tests/ItemPage.test.tsx`: renders cover/placeholder, title, creator, media badge, expandable synopsis (show more/less), genres (and omitted when none); shows not-found state for an unresolvable id; renders an injection payload as plain text (SC-006).
- [x] T007 [P] [US1] Test `frontend/tests/SearchBackNav.test.tsx`: searching sets the URL query; unmount/remount of `Search` (simulating back) restores query + results from cache (FR-014/SC-007).

### Implementation

- [x] T008 [P] [US1] Books detail adapter `backend/src/providers/google-books-item.ts` implementing `ItemProvider` via `GET /books/v1/volumes/{id}`, normalizing to `ItemDetail` (reuse mapping style from `google-books.ts`).
- [x] T009 [P] [US1] iTunes detail adapter `backend/src/providers/itunes-item.ts` implementing `ItemProvider` for music/audiobook/podcast via `GET /lookup?id={id}` (entity per media type), normalizing to `ItemDetail`.
- [x] T010 [US1] `ItemService` in `backend/src/services/item.ts`: cache-aside (`item:{mediaType}:{providerId}`, `ITEM_TTL_SECONDS`) with best-effort Redis + stale fallback; routes media type → adapter; returns `ItemDetail | null`.
- [x] T011 [US1] API route `backend/src/api/items.ts`: `GET /api/items/:mediaType/:providerId` (auth-required) returning `ItemPageDTO`; in US1 returns real `item`/`detailAvailable` with an empty `stats` placeholder (zero-filled shelfCounts, null average, [] activity); validates mediaType; 404 logic per contract; structured logs incl. cache hit/miss. Register the route in the API app.
- [x] T012 [P] [US1] Frontend `useItem(mediaType, providerId)` query hook in `frontend/src/services/item.ts` (TanStack Query; key `['item', mediaType, providerId]`).
- [x] T013 [P] [US1] `frontend/src/components/ItemLink.tsx` wrapping cover/title with a router link to `itemPathFor(...)`; no link when `providerId` is absent.
- [x] T014 [US1] `frontend/src/pages/ItemPage.tsx`: detail layout (cover/placeholder, title, creator, media badge, expandable synopsis, genres, provider link via `httpUrl`), loading/not-found/provider-error states; community sections stubbed for US3.
- [x] T015 [US1] Register route `/item/:mediaType/:providerId` → `ItemPage` in `frontend/src/App.tsx` (inside the protected layout).
- [x] T016 [US1] Wire `ItemLink` into cover/title of `DiscoverItemCard.tsx`, `ActivityCard.tsx` (when providerId present), and the My Library card in `pages/Library.tsx`.
- [x] T017 [US1] Rework `frontend/src/pages/Search.tsx` to drive submitted `(category, query)` from the URL (`useSearchParams`), so results come from the query cache and survive back-navigation (FR-014); keep the live form inputs local.

**Checkpoint**: Item page is viewable and deep-linkable from all lists; Search back-nav preserved. MVP complete.

## Phase 4: User Story 2 — Act on the item from its page (P1)

**Goal**: Shelf, currently-reading + share, recommend, and star rating on the item page, operating on the signed-in user.

**Independent test**: From the page, set a shelf (appears in My Library), rate (persists; re-click clears), recommend (appears in recommendations) — own-data only.

### Tests (write first, must fail)

- [x] T018 [P] [US2] Extend `frontend/tests/ItemPage.test.tsx` (or a sibling) to assert: shelf select adds/moves shelf and reflects state; star rating sets and clears on re-click; recommend shows "Recommended ✓"; "I'm reading/listening to this" shelves current and opens the share overlay.

### Implementation

- [x] T019 [US2] `frontend/src/components/ItemControls.tsx`: shared control cluster (shelf `<select>` across all shelves, "I'm reading/listening to this" with the share bridge + concurrency guard, Recommend toggle, 1–5 star rating with clear-on-reclick) reusing `useAddToLibrary`/`useLibraryShelves`/`useRecommend`/`useRatings`/`useSetRating`/`useClearRating`.
- [x] T020 [US2] Render `ItemControls` in `ItemPage.tsx`; on successful mutation, invalidate the `['item', …]` query (and existing library/ratings caches) so personal controls and counts refresh.

**Checkpoint**: Full action parity with cards on the item page.

## Phase 5: User Story 3 — Community context (P2)

**Goal**: Average rating + count, per-shelf user counts, and recent activity — from our own DB; resilient to provider outage.

**Independent test**: Seed ratings/shelves/activity across users; confirm aggregates match and empty states render; provider failure still returns stats.

### Tests (write first, must fail)

- [x] T021 [P] [US3] Integration test `backend/tests/integration/item-stats.test.ts` (prisma-fake): rating average (1-decimal) + count, per-shelf distinct-user counts, recent activity newest-first capped ≤10 excluding deleted; empty states (null average, zero counts, []).
- [x] T022 [P] [US3] Integration test `backend/tests/integration/item-detail-resilience.test.ts`: when the `ItemProvider` throws, the endpoint returns 200 with `detailAvailable:false` and populated `stats` (SC-005).

### Implementation

- [x] T023 [US3] `ItemStatsService` in `backend/src/services/item-stats.ts`: rating aggregate (`Rating._avg/_count`), shelf counts (`LibraryItem.groupBy(shelf)` zero-filled), recent activity (`Activity` by `(mediaType, providerId)`, non-deleted, `createdAt desc`, take 10 → `ItemActivityDTO`).
- [x] T024 [US3] Wire `ItemStatsService` into `backend/src/api/items.ts`: compute detail and stats concurrently; stats always returned even when detail lookup fails; optional short cache (`item-stats:…`, `ITEM_STATS_TTL_SECONDS`).
- [x] T025 [US3] Add community sections to `frontend/src/pages/ItemPage.tsx`: average rating (one decimal) + count, per-shelf counts, recent-activity list (author + relative time, plain text), each with empty states.
- [x] T026 [P] [US3] Component test for the community sections render + empty states in `frontend/tests/ItemPage.test.tsx`.

**Checkpoint**: All three user stories complete.

## Phase 6: Polish & Cross-Cutting

- [x] T027 [P] Styles for the item page in `frontend/src/index.css` (Impeccable tokens; cover-forward two-column layout collapsing to one column; reuse existing card/section/chip styles; no new design system).
- [x] T028 [P] Update `README.md` and `AGENTS.md` to document the item page + `GET /api/items/:mediaType/:providerId`.
- [x] T029 Run all gates: `corepack pnpm -C backend test`, `-C frontend test`, `-w lint`, `-C frontend build`, `-C backend build`; verify quickstart.md scenarios; confirm structured logs include item lookup cache hit/miss.

---

## Dependencies & Order

- **Setup (T001)** → **Foundational (T002–T004)** → user stories.
- **US1 (T005–T017)** depends only on Foundational. Delivers the MVP.
- **US2 (T018–T020)** depends on US1 (the page + route exist).
- **US3 (T021–T026)** depends on US1 (endpoint + page exist); independent of US2.
- **Polish (T027–T029)** last.

## Parallel Opportunities

- Foundational: T002 ‖ T003 (different files).
- US1 tests: T005 ‖ T006 ‖ T007. US1 impl: T008 ‖ T009 (adapters) ‖ T012 ‖ T013 (frontend hook/link) before the page (T014) that consumes them.
- US3 tests: T021 ‖ T022. Polish: T027 ‖ T028.

## Implementation Strategy

Ship the MVP first (Phases 1–3 = US1): a viewable, deep-linkable item page wired into every list with Search back-nav fixed. Then add actions (US2) and community context (US3) as independent increments. One PR for the feature (or stack US2/US3 on US1 if reviewed incrementally).
