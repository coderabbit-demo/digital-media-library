# Phase 0 Research: Discover (Trending by Category)

Stack inherited from 001/002. This records the decisions new to Discover —
provider selection, the abstraction boundary, and the caching/resilience model.
No `NEEDS CLARIFICATION` remain (the spec deferred provider choice to planning;
resolved below).

## 1. Provider selection (per category)

- **Decision**:
  - **Books → NYT Books API (all bestseller lists / every genre) + Google Books**,
    merged and deduped via a composite book provider. NYT's "best sellers overview"
    returns all current lists (genres) in one call, interleaved for genre coverage;
    Google Books adds newest-per-genre recommendations (keyless at low quota, optional
    `GOOGLE_BOOKS_API_KEY` for headroom). Each source degrades independently — if one
    fails or is unconfigured, the other still serves. (Amazon was considered but
    deferred: the Product Advertising/Creators API is credential-gated and no key is
    available.)
  - **Music → Spotify Web API** (New Releases + Featured/curated charts playlist).
    Client-credentials flow (no user auth), well-documented, predictable limits.
  - **Audiobooks → Apple iTunes** (RSS "top audiobooks" feed + iTunes Search API).
    No API key, stable, covers audiobooks where most APIs don't.
- **Rationale**: The constitution requires stable, documented providers with
  predictable quotas (Principle III/V). These are the strongest free, well-known
  sources per category; "trending" is mapped to each provider's closest concept
  (bestsellers / new-and-featured / top charts).
- **Alternatives considered**: Google Books (great for metadata/search but weaker
  "trending" signal — may use later for enrichment/search in 004); Last.fm/Apple
  Music for music (Spotify's free client-credentials is simpler); a single provider
  for all three (none covers books+music+audiobooks well).

## 2. Provider-abstraction boundary

- **Decision**: A single `ContentProvider` interface — `getTrending(limit): Promise<TrendingItem[]>`
  — with one adapter per category under `backend/src/providers/`. Feature code and
  the `TrendingService` depend only on the interface; **no module outside
  `providers/` imports a provider SDK/URL** (Principle III).
- **Rationale**: Lets us swap providers, add caching/resilience uniformly, and test
  with a fake provider. Each adapter normalizes its provider's payload to a common
  `TrendingItem` (mediaType, title, creator, coverUrl, providerId).
- **Alternatives considered**: Calling providers directly from the route/service —
  violates the principle and spreads provider quirks/secret handling.

## 3. Caching & resilience (stale-on-failure)

- **Decision**: Cache-aside via the existing Redis `CacheService`, keyed per category,
  with two entries per category:
  - **fresh** key with a TTL (default ~3h; configurable) — a hit serves immediately
    (`stale: false`).
  - **last-known-good** snapshot with a long/again-refreshed retention — used only
    when a live fetch is needed but fails.
  On request: serve fresh if present; else fetch via the provider (with a short
  timeout), and on success update both entries; on failure serve the last-known-good
  snapshot flagged `stale: true`; if neither exists, return a clear empty/unavailable
  state. Refresh is **lazy** (on first request after TTL expiry).
- **Rationale**: Directly satisfies FR-003–FR-007: cached within TTL, stale-but-
  available on outage, clear empty state on cold failure, and call volume bounded by
  the TTL (≥95% cache hits, SC-002; within quota, SC-005). Lazy refresh is sufficient
  at launch scale; a scheduled warmer can be added later without changing the contract.
- **Alternatives considered**: TTL-only cache (no stale fallback) — fails SC-003 on
  outage; scheduled background refresh now — more infra than needed for ~100 users.

## 4. Secrets & configuration

- **Decision**: `NYT_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` are added
  as Secret Manager secrets (Terraform) and injected into Cloud Run; loaded/validated
  in the config module. Apple/iTunes needs no key. Spotify access tokens
  (client-credentials) are fetched on demand and cached in Redis until expiry.
- **Rationale**: No keys in source (Principle IV); IaC for all resources. Caching the
  Spotify token avoids a token call per request.
- **Alternatives considered**: Env-only/local files in cloud — violates the secrets rule.

## 5. API shape & start-activity reuse

- **Decision**: `GET /api/discover/{category}` (auth-guarded) → `{ items: TrendingItemDTO[], stale: boolean, category }`. "Start an activity from a Discover item" reuses the existing `POST /api/activities` — the frontend opens the compose overlay (002) pre-filled with the item's media type/title/creator; no new backend for that path.
- **Rationale**: One small endpoint; reuse of the proven posting flow keeps scope tight (FR-008/FR-009). The `stale` flag drives the "may be out of date" UI (FR-006).
- **Alternatives considered**: A combined multi-category endpoint — categories are viewed independently; per-category keeps caching and requests simple.

## 6. Resilience details

- **Decision**: Per-provider request timeout (a few seconds); on timeout/error treat
  as failure → stale fallback. Log provider name, latency, outcome, and cache
  hit/miss/stale for observability (Principle V). Optional lightweight failure backoff
  (don't hammer a down provider within a short window) via a short "cooldown" cache key.
- **Rationale**: Keeps Discover responsive (SC-001) and protects quotas during partial
  outages (FR-007 / edge cases).

## 7. Frontend Discover page

- **Decision**: Replace the 002 `CategoryPlaceholder` with a `Discover` page using
  `useDiscover(category)`; render a responsive grid of `DiscoverItemCard`s (cover,
  title, creator) with a `StaleBanner` when `stale`, an empty/unavailable state, and a
  per-item "I'm reading/listening to this" action that opens the compose overlay
  pre-filled. MD3 styling/tokens reused.
- **Rationale**: Fits the existing shell/nav and MD3 system; minimal new UI surface.

## Resolved unknowns

No `NEEDS CLARIFICATION` remain. Providers chosen (§1); abstraction, caching, secrets,
API shape, and resilience defined. Exact TTLs/timeouts are configurable values set in
config (defaults above), tunable without contract changes.
