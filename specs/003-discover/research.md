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
  - **Music → Apple Music RSS** (keyless "most-played albums" marketing feed:
    `https://rss.marketingtools.apple.com/api/v2/us/music/most-played/{n}/albums.json`).
    No API key, stable, and each album carries a genre for genre-sectioned grouping.
    (Spotify was originally chosen but dropped: its `/browse/new-releases` is
    deprecated and now requires user auth — 403 under client-credentials — and
    `/v1/search` proved flaky with intermittent 400s.)
  - **Audiobooks → Apple RSS** (keyless "top audiobooks" marketing feed on the
    canonical host `rss.marketingtools.apple.com`; the older
    `rss.applemarketingtools.com` 301-redirects). No API key, stable, covers
    audiobooks where most APIs don't.
  - **Podcasts → Apple RSS** (keyless "top podcasts" marketing feed:
    `https://rss.marketingtools.apple.com/api/v2/us/podcasts/top/{n}/podcasts.json`).
    No API key; each podcast carries a genre for genre-sectioned grouping.
- **Rationale**: The constitution requires stable, documented providers with
  predictable quotas (Principle III/V). These are the strongest free, well-known
  sources per category; "trending" is mapped to each provider's closest concept
  (bestsellers / most-played / top charts). The Apple RSS marketing feeds are keyless
  and consistent across music, audiobooks, and podcasts.
- **Alternatives considered**: Spotify for music (dropped — deprecated/auth-gated
  endpoints, see above); Last.fm for music (Apple's keyless RSS is simpler and needs
  no credentials); a single provider for all four categories (none covers
  books+music+audiobooks+podcasts well).

## 2. Provider-abstraction boundary

- **Decision**: A single `ContentProvider` interface — `getTrending(limit): Promise<TrendingItem[]>`
  — with one adapter per category under `backend/src/providers/`. Feature code and
  the `TrendingService` depend only on the interface; **no module outside
  `providers/` imports a provider SDK/URL** (Principle III).
- **Rationale**: Lets us swap providers, add caching/resilience uniformly, and test
  with a fake provider. Each adapter normalizes its provider's payload to a common
  `TrendingItem` (mediaType, title, creator, coverUrl, providerId, and genre where the
  provider supplies one).
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

- **Decision**: `NYT_API_KEY` and `GOOGLE_BOOKS_API_KEY` (both optional) are added
  as Secret Manager secrets (Terraform) and injected into Cloud Run; loaded/validated
  in the config module. The Apple RSS feeds (music, audiobooks, podcasts) need no key
  or auth, so no provider tokens are fetched or cached.
- **Rationale**: No keys in source (Principle IV); IaC for all resources. Keyless
  Apple feeds keep the secret surface minimal.
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
  pre-filled. Books, music, and podcasts carry a genre and are grouped into genre
  sections (the genre picker skips Apple's generic top-level parent — "Music"/"Podcasts"
  — in favor of the specific genre, e.g. Hip-Hop/Rap, News); audiobooks have no genre
  and render ungrouped. MD3 styling/tokens reused.
- **Rationale**: Fits the existing shell/nav and MD3 system; minimal new UI surface.

## Resolved unknowns

No `NEEDS CLARIFICATION` remain. Providers chosen (§1); abstraction, caching, secrets,
API shape, and resilience defined. Exact TTLs/timeouts are configurable values set in
config (defaults above), tunable without contract changes.
