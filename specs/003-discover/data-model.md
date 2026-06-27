# Phase 1 Data Model: Discover (Trending by Category)

This feature introduces **no new persistent tables and no schema changes**. Trending
data is **cached, not authoritative** — it lives in Redis and is rebuildable from the
providers. The model below is the provider/normalized read model and the cache layout.

## Normalized read model (not persisted in CloudSQL)

- **TrendingItem** (internal, returned by every provider adapter)
  - `mediaType`: book | music | audiobook
  - `title`: string
  - `creator`: string | null — author (books/audiobooks) or artist (music)
  - `coverUrl`: string | null — cover/art image URL when supplied by the provider
  - `providerId`: string — the provider's stable id for the item
  - `provider`: string — which provider produced it (for diagnostics)

- **DiscoverPage** (API response)
  - `category`: book | music | audiobook
  - `items`: TrendingItemDTO[]
  - `stale`: boolean — true when served from the last-known-good snapshot because a
    fresh fetch was unavailable (drives the "may be out of date" UI; FR-006)

### Validation / rules

- Adapters MUST normalize provider payloads into `TrendingItem` and MUST treat all
  text as plain text (no markup) — FR-009.
- Items missing `creator`/`coverUrl` are allowed; the UI renders placeholders.
- `GET /api/discover/{category}` MUST require authentication and MUST go through the
  cache + provider abstraction only (no direct provider calls elsewhere) — FR-002/FR-004.

## Cache layout (Redis, via existing CacheService)

Per category `c ∈ {book, music, audiobook}`:

- `discover:fresh:{c}` — normalized `TrendingItem[]`, TTL = `DISCOVER_TTL_SECONDS`
  (default ~3h). A hit serves `stale: false`.
- `discover:lastgood:{c}` — the most recent successful `TrendingItem[]`, long
  retention; served `stale: true` only when a refresh is needed but fails.
- `discover:cooldown:{c}` — short-lived marker to avoid hammering a failing provider.
- `provider:spotify:token` — cached Spotify client-credentials token until expiry.

All cache values are derived/ephemeral and safe to evict; on total miss + provider
failure the endpoint returns an empty `items` list with a clear unavailable state.

## Shared DTOs (add to `packages/shared`)

- `MediaCategory` helpers / mapping between route segment (`books|music|audiobooks`)
  and `MediaType` (`book|music|audiobook`).
- `TrendingItemDTO`: `{ mediaType: MediaType; title: string; creator: string | null; coverUrl: string | null; providerId: string }`
- `DiscoverPageDTO`: `{ category: MediaType; items: TrendingItemDTO[]; stale: boolean }`

## Referenced entities (unchanged)

- **Activity Update (feature 001)** — a Discover item can seed one via the existing
  `POST /api/activities` (pre-filled compose); no change to the Activity model here.
- **User Profile (feature 001)** — identifies the authenticated viewer.
