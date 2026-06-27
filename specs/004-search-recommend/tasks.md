# Tasks: Search & Recommendations (004)

## Phase 1: Setup & Foundational

- [X] T001 Add `Recommendation` model to backend/prisma/schema.prisma and create migration `add_recommendation`
- [X] T002 [P] Add `SearchPageDTO`, `createRecommendationSchema`, and extend `RecommendationDTO` (coverUrl, providerId, canRemove) in packages/shared/src/index.ts
- [X] T003 [P] Add `SEARCH_TTL_SECONDS` to backend/src/config/index.ts

## Phase 2: User Story 1 — Search & recommend (P1)

- [X] T010 [US1] SearchProvider interface in backend/src/providers/search-provider.ts
- [X] T011 [P] [US1] GoogleBooksSearchProvider in backend/src/providers/google-books-search.ts
- [X] T012 [P] [US1] ITunesSearchProvider (music/audiobook/podcast) in backend/src/providers/itunes-search.ts
- [X] T013 [US1] SearchService (cache-aside per mediaType+query) in backend/src/services/search.ts
- [X] T014 [US1] RecommendationService (create idempotent, remove own, list recent) in backend/src/services/recommendations.ts
- [X] T015 [US1] GET /api/search route in backend/src/api/search.ts
- [X] T016 [US1] POST/DELETE /api/recommendations routes in backend/src/api/recommendations.ts
- [X] T017 [US1] Populate home recommendations from RecommendationService in backend/src/services/home.ts
- [X] T018 [US1] Wire search + recommendation services/providers in backend/src/app.ts
- [X] T019 [P] [US1] Search page + /search route + nav entry (frontend: pages/Search.tsx, App.tsx, AppShell.tsx)
- [X] T020 [P] [US1] useSearch + recommendation hooks (frontend services/search.ts, services/recommendations.ts)
- [X] T021 [US1] "Recommend" action on DiscoverItemCard; remove control in RecommendationsPanel
- [X] T022 [US1] Tests: backend unit (search providers, services), integration (search cache, recommendations idempotent/owner), shared schema, frontend (Search, Recommend)

## Phase 3: User Story 2 — Start activity from a search result (P2)

- [X] T030 [US2] Reuse compose pre-fill from a search result (DiscoverItemCard already raises onStartActivity; ensure Search wires it) + test

## Phase 4: Polish

- [X] T040 [P] Update README.md, AGENTS.md, .env.example notes (no new keys)
- [X] T041 Run gates (typecheck, lint, unit, integration, build) + live verify

## Dependencies

- T001–T003 before Phase 2. T010 before T011–T013. T013/T014 before routes (T015–T017). T018 after services/providers. Frontend (T019–T021) after DTOs (T002).

## MVP

User Story 1 (search + recommend + home population) is the MVP.
