# Implementation Plan: Discover (Trending by Category)

**Branch**: `003-discover` | **Date**: 2026-06-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-discover/spec.md`

## Summary

Add per-category Discover views (Books, Music, Audiobooks) showing trending items
from external providers, accessed exclusively through a new **provider-abstraction
layer** and **cached with stale-on-failure** behavior — the realization of
constitution Principle III. A single internal `ContentProvider` interface has one
adapter per category (NYT Books, Spotify, Apple/iTunes); a `TrendingService` serves
from Redis (fresh within TTL), refreshes lazily on expiry, and falls back to the
last-known-good snapshot (flagged stale) or a clear empty state when a provider is
unavailable. One auth-guarded endpoint `GET /api/discover/{category}` returns
normalized items. From a Discover item users can start a "currently reading/listening"
activity by reusing the feature-001 posting flow. Provider API keys live in Secret
Manager (Terraform). Frontend fills in the category Discover pages (placeholders from
002).

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 22 (backend); React 18 + Vite (frontend) — unchanged.

**Primary Dependencies**: Backend — Fastify, existing Redis `CacheService`, `undici` (HTTP to providers), zod (validate/normalize provider payloads), `@dml/shared`. Frontend — React + Vite, TanStack Query, Material Design 3.

**External providers** (chosen here; research §1): **Books → NYT Books API** (bestseller lists as "trending"); **Music → Spotify Web API** (new releases / featured, client-credentials); **Audiobooks → Apple iTunes** (RSS top-audiobooks / Search, no key). All accessed only via the provider abstraction.

**Storage**: No new persistent tables. Trending data is **cached in Memorystore Redis** (existing), not authoritative. CloudSQL unchanged.

**Secrets**: `NYT_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` in Secret Manager (Apple needs none) — added via Terraform; runtime SA granted accessor.

**Testing**: Vitest unit (provider adapters with mocked HTTP via `undici` MockAgent; cache/stale logic); Fastify `inject` contract test for `/api/discover/{category}`; integration (cache hit / lazy refresh / stale fallback) with a fake provider + real Redis or in-memory cache; frontend component tests for the Discover page (list, stale banner, empty/unavailable state, start-activity).

**Target Platform**: Web SPA + Cloud Run. Unchanged.

**Performance Goals**: Discover view ≤ 2s (SC-001); ≥95% of views served from cache (SC-002); 100% render under provider outage via cache/empty (SC-003); provider call volume within free quotas at ~100 concurrent (SC-005).

**Constraints**: No direct provider calls outside the abstraction; cache every provider response with a TTL; serve stale-but-available on failure; all external text rendered as plain text; navigation must not exceed the refresh cadence.

**Scale/Scope**: ~100 concurrent. Lazy (cache-aside) refresh; no scheduled jobs in this feature.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Constitution v1.3.0:

| Principle / Constraint | Status | How this plan complies |
|------------------------|--------|------------------------|
| I. Spec-Driven Development | ✅ Pass | Built from the approved 003 spec; plan precedes code; clarifications resolved in research. |
| II. Test-First Quality Gates | ✅ Pass | Contract (`/api/discover`), integration (cache hit/refresh/stale), unit (adapters + cache), and frontend component tests authored first. |
| III. Resilient Integrations & Aggressive Caching | ✅ Pass (central) | **This feature implements the principle**: one `ContentProvider` abstraction (no direct provider calls in feature code), every response cached with TTL, lazy refresh, and serve-stale-on-failure. |
| IV. Security & Privacy by Default | ✅ Pass | Provider keys in Secret Manager (never in source); endpoint auth-guarded; external text rendered as plain text. |
| V. Cloud-Native, Cost-Aware Operations | ✅ Pass | Caching keeps calls within free quotas (SC-005); stateless; structured logs incl. cache hit/miss + provider latency/failure; stable, documented providers. |
| Constraint: Terraform IaC | ✅ Pass | New Secret Manager entries + IAM grants added via `infra/` Terraform. |
| Constraint: Cloud Logging | ✅ Pass | Reuses existing logging; adds provider-call observability. |
| Workflow: GitHub Issues + CodeRabbit | ✅ Pass | Tasks → issues; PR runs CodeRabbit. |

**Result**: PASS — no violations. Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/003-discover/
├── plan.md, research.md, data-model.md, quickstart.md
├── contracts/openapi.yaml      # GET /api/discover/{category}
└── checklists/requirements.md
```

### Source Code (additions to the monorepo)

```text
backend/src/
├── providers/
│   ├── content-provider.ts     # ContentProvider interface + TrendingItem (raw→normalized)
│   ├── nyt-books.ts            # Books adapter (NYT bestseller lists)
│   ├── spotify-music.ts       # Music adapter (Spotify new releases/featured; token mgmt)
│   └── apple-audiobooks.ts    # Audiobooks adapter (Apple iTunes RSS/Search)
├── services/discover.ts        # TrendingService: cache-through + lazy refresh + stale fallback
├── api/discover.ts             # GET /api/discover/{category} (auth-guarded)
└── config/index.ts             # + NYT/Spotify secrets

frontend/src/
├── pages/Discover.tsx          # replaces CategoryPlaceholder for /books|/music|/audiobooks
├── components/DiscoverList.tsx, DiscoverItemCard.tsx, StaleBanner.tsx
└── services/discover.ts        # useDiscover(category)

packages/shared/src/index.ts    # + TrendingItemDTO, DiscoverPageDTO, category helpers
infra/                          # + Secret Manager secrets (NYT/Spotify) + SA accessor
```

**Structure Decision**: Extends the existing monorepo. The new `backend/src/providers/`
package is the constitution's provider-abstraction boundary; everything else reuses
established patterns (services, auth-guarded routes, Redis cache, MD3 frontend).

## Complexity Tracking

> No constitutional violations — intentionally empty.
