# Implementation Plan: Search & Recommendations (004)

## Summary

Add media **search** across the four categories and a user-driven
**recommendation** system that populates the home recommendations region
(feature 002). Search reuses the provider-abstraction + cache layer (Principle
III) with keyless providers; recommendations are stored locally and surfaced
community-wide on the home page. Both search results and Discover items expose
"Recommend" (and reuse the 001 posting flow to start an activity).

## Technical Context

- **Stack**: unchanged — React/Vite SPA (MD3), Fastify/Node 22, Prisma/CloudSQL,
  Redis cache, shared zod/DTOs (`packages/shared`).
- **Search providers** (keyless, via the provider abstraction + cache):
  - Books → **Google Books** volumes search (`q=<term>`); uses the optional
    `GOOGLE_BOOKS_API_KEY` for higher quota (anonymous quota is shared/low).
  - Music / Audiobooks / Podcasts → **iTunes Search API**
    (`https://itunes.apple.com/search?term=&media=&entity=&country=US`), keyless.
- **No new secrets.** Reuses the keys/feeds already configured in 003.

## Constitution Check

- **III (provider abstraction + cache)**: search goes through a `SearchProvider`
  per category and a cache-aside `SearchService` (no direct provider calls in
  routes; repeat queries served from cache → SC-003). PASS.
- **I/II (auth, plain text)**: all routes require auth; all provider-sourced text
  rendered as plain text; recommendation input length-limited + plain text. PASS.
- **V (stateless)**: recommendations persist in PostgreSQL; cache in Redis. PASS.

## Project Structure (new/changed)

```
packages/shared/src/index.ts        # SearchPageDTO, createRecommendationSchema, RecommendationDTO (+cover/providerId)
backend/prisma/schema.prisma        # + model Recommendation (+ migration)
backend/src/providers/
  search-provider.ts                # SearchProvider interface
  google-books-search.ts            # books search
  itunes-search.ts                  # music/audiobook/podcast search (media-parametrized)
backend/src/services/
  search.ts                         # SearchService (cache-aside per (mediaType, query))
  recommendations.ts                # RecommendationService (create idempotent / remove own / list recent)
  home.ts                           # populate recommendations from RecommendationService
backend/src/api/
  search.ts                         # GET /api/search
  recommendations.ts               # POST /api/recommendations, DELETE /api/recommendations/:id
frontend/src/
  pages/Search.tsx                  # search page (+ /search route, nav entry)
  services/search.ts                # useSearch
  services/recommendations.ts       # useRecommend / useRemoveRecommendation
  components/DiscoverItemCard.tsx   # + "Recommend" action (used by Discover + Search)
  components/RecommendationsPanel.tsx # remove control for own recommendations
```

## Phases

- **Phase 0 — research.md**: provider selection + cache strategy (done).
- **Phase 1 — data-model.md, contracts/openapi.yaml, quickstart.md** (done).
- **Phase 2 — tasks.md** via `/speckit-tasks`.

See `research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`.
