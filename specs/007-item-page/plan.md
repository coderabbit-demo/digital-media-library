# Implementation Plan: Item Detail Page

**Branch**: `007-item-page` | **Date**: 2026-06-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-item-page/spec.md`

## Summary

A deep-linkable item detail page at `/item/:mediaType/:providerId` for any media item, reachable by clicking an item's cover/title from Discover, Search, My Library, and feed cards. A new provider-backed **item lookup** (by provider id, cache-aside with stale fallback) supplies the detail (title, creator, cover, synopsis, genres, provider URL, optional series/edition label). The page reuses the existing item controls (shelf, currently-reading + share, recommend, star rating) and adds **community sections** computed from our own DB: average rating + count (Rating), per-shelf user counts (LibraryItem), and recent activity referencing the item (Activity). A single endpoint `GET /api/items/:mediaType/:providerId` returns `{ item, stats }`; community stats render even if the provider detail lookup fails. The Search page is reworked so its query lives in the URL, so returning from an item restores the results (FR-014).

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22 (backend), React 18 + Vite (frontend); pnpm monorepo.

**Primary Dependencies**: Fastify, Prisma (CloudSQL Postgres), Redis (Memorystore) via existing `CacheService`; React Router, TanStack Query, zod (`packages/shared`). Providers: Google Books (`volumes/{id}`) and iTunes Lookup (`lookup?id=`) — both keyless, already used.

**Storage**: Postgres via Prisma (existing `Rating`, `LibraryItem`, `Activity`); Redis for provider-response caching. No new tables.

**Testing**: Vitest (backend unit/contract with `prisma-fake`, frontend component), Playwright (e2e). Test-first per Constitution II.

**Target Platform**: Cloud Run services (backend API + static frontend), us-central1.

**Project Type**: Web application (existing `backend/`, `frontend/`, `packages/shared`).

**Performance Goals**: Item page interactive quickly on warm cache (detail served from Redis); community sections never blocked by a provider outage (SC-005).

**Constraints**: Authenticated-only; plain-text rendering of all provider/user text (no markup); aggregate counts may be eventually consistent within the cache window.

**Scale/Scope**: One new route + one new endpoint + one provider capability (`getItem`) across 2 provider families; ~4 link integrations; no schema migration.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Spec-Driven Development**: PASS — `spec.md` approved; this plan resolves all unknowns; no code before plan.
- **II. Test-First Quality Gates**: PASS (planned) — contract test for the new endpoint, integration tests for stats aggregation and provider-failure resilience, and frontend component tests authored before/with implementation; CI runs full suite.
- **III. Resilient Integrations & Aggressive Caching**: PASS — item lookup goes through a new provider boundary method (`getItem`) under `backend/src/providers/`; responses cached with explicit TTL and stale fallback; only documented, keyless provider APIs (Google Books volume, iTunes lookup) used.
- **IV. Security & Privacy by Default**: PASS — endpoint behind existing auth; mutations (shelf/rating/recommend) reuse already-authorized routes (own-data only); all provider/user text rendered as plain text; no new secrets.
- **V. Cloud-Native, Cost-Aware Operations**: PASS — stateless handlers; structured logs incl. cache hit/miss for the new lookup; aggregates are bounded queries; no new infra (reuses Redis/CloudSQL). No Terraform change required.

No violations → Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/007-item-page/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (item-endpoint contract)
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── providers/
│   │   ├── item-provider.ts          # NEW: ItemProvider interface (getItem)
│   │   ├── google-books-item.ts      # NEW: books detail via volumes/{id}
│   │   └── itunes-item.ts            # NEW: music/audiobook/podcast via lookup?id=
│   ├── services/
│   │   ├── item.ts                   # NEW: ItemService (cache-aside detail)
│   │   └── item-stats.ts             # NEW: rating avg/count, shelf counts, recent activity
│   └── api/
│       └── items.ts                  # NEW: GET /api/items/:mediaType/:providerId
└── tests/
    ├── contract/items.test.ts        # NEW
    └── integration/item-*.test.ts    # NEW (detail resilience, stats)

frontend/
├── src/
│   ├── pages/
│   │   └── ItemPage.tsx              # NEW route /item/:mediaType/:providerId
│   ├── components/
│   │   ├── ItemControls.tsx          # NEW: shared shelf+rating+recommend+currently controls
│   │   └── ItemLink.tsx              # NEW: wraps cover/title → item route
│   ├── services/
│   │   └── item.ts                   # NEW: useItem(mediaType, providerId)
│   └── (App.tsx routes, Search.tsx query-in-URL, DiscoverItemCard/ActivityCard/Library links)
└── tests/
    ├── ItemPage.test.tsx             # NEW
    └── SearchBackNav.test.tsx        # NEW (FR-014)

packages/shared/
└── src/index.ts                      # NEW DTOs: ItemDetailDTO, ItemStatsDTO, ItemPageDTO
```

**Structure Decision**: Existing web-app layout (Option 2). New code follows the established provider→service→api layering on the backend and page/component/service layering on the frontend. No new top-level directories.

## Complexity Tracking

No constitutional violations; section intentionally empty.
