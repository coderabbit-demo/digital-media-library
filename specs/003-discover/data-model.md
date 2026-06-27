# Phase 1 Data Model: Discover (Trending by Category)

This feature introduces **no new persistent tables**. The only schema change is adding
`podcast` to the `MediaType` enum (Prisma migration `add_podcast_media_type`) so
podcast activities can be posted. Trending data itself is **cached, not authoritative**
— it lives in Redis and is rebuildable from the providers. The model below is the
provider/normalized read model and the cache layout.

## Normalized read model (not persisted in CloudSQL)

- **TrendingItem** (internal, returned by every provider adapter)
  - `mediaType`: book | music | audiobook | podcast
  - `title`: string
  - `creator`: string | null — author (books/audiobooks), artist (music), or show
    publisher (podcasts)
  - `coverUrl`: string | null — cover/art image URL when supplied by the provider
  - `providerId`: string — the provider's stable id for the item
  - `provider`: string — which provider produced it (for diagnostics)

- **DiscoverPage** (API response)
  - `category`: book | music | audiobook | podcast
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

Per category `c ∈ {book, music, audiobook, podcast}`:

- `discover:fresh:{c}` — normalized `TrendingItem[]`, TTL = `DISCOVER_TTL_SECONDS`
  (default ~3h). A hit serves `stale: false`.
- `discover:lastgood:{c}` — the most recent successful `TrendingItem[]`, long
  retention; served `stale: true` only when a refresh is needed but fails.
- `discover:cooldown:{c}` — short-lived marker to avoid hammering a failing provider.

The Apple RSS feeds (music, audiobooks, podcasts) are keyless and require no token
caching; book providers (NYT/Google Books) use optional API keys, not OAuth tokens.

All cache values are derived/ephemeral and safe to evict; on total miss + provider
failure the endpoint returns an empty `items` list with a clear unavailable state.

## Shared DTOs (add to `packages/shared`)

- `MediaCategory` helpers / mapping between route segment
  (`books|music|audiobooks|podcasts`) and `MediaType` (`book|music|audiobook|podcast`).
- `TrendingItemDTO`: `{ mediaType: MediaType; title: string; creator: string | null; coverUrl: string | null; providerId: string }`
- `DiscoverPageDTO`: `{ category: MediaType; items: TrendingItemDTO[]; stale: boolean }`

## Referenced entities (unchanged)

- **Activity Update (feature 001)** — a Discover item can seed one via the existing
  `POST /api/activities` (pre-filled compose); no change to the Activity model here.
- **User Profile (feature 001)** — identifies the authenticated viewer.
