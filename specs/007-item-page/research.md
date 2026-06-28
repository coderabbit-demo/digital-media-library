# Phase 0 Research: Item Detail Page

## Decision: Provider-backed item lookup by id (new `ItemProvider` boundary)

- **Decision**: Add an `ItemProvider` interface with `getItem(providerId): Promise<ItemDetail | null>`, one adapter per provider family, behind the existing provider boundary (Principle III). Books → Google Books `GET /books/v1/volumes/{id}`; music/audiobooks/podcasts → iTunes `GET /lookup?id={id}` (entity inferred from media type). Both are keyless and already in use for trending/search.
- **Rationale**: Detail pages must be deep-linkable, so the server must resolve an item from `(mediaType, providerId)` alone — search/trending payloads aren't available on a cold load. Both providers expose stable, documented by-id endpoints, so no new credentials/quota risk.
- **Alternatives considered**:
  - *Client-only (pass item via navigation state)* — rejected: breaks refresh/share (fails FR-001/SC-002).
  - *Persist a local `Item` table* — rejected: adds an owned record + migration for data we can fetch+cache; spec says detail is provider-sourced, not first-class.

## Decision: Cache-aside with stale fallback for item detail

- **Decision**: `ItemService.getItem` uses key `item:{mediaType}:{providerId}`, TTL via a new `ITEM_TTL_SECONDS` config (default ~24h; detail is far more stable than trending). Best-effort Redis get/set mirroring `SearchService`; on provider failure, serve last-cached value if present, else surface "unavailable".
- **Rationale**: Item metadata rarely changes; aggressive caching cuts provider calls and makes the warm-cache path fast (SC-005). Stale-but-cached satisfies Principle III.
- **Alternatives considered**: No cache (rejected — repeated provider hits, slow, quota); short TTL like trending (rejected — detail is stable, longer TTL is cheaper).

## Decision: Single endpoint `GET /api/items/:mediaType/:providerId` → `{ item, stats }`

- **Decision**: One authenticated endpoint returns the detail plus community stats. Detail and stats are computed concurrently; **a provider-detail failure does not fail the request** — return `item: null` (or last-cached) with `detailAvailable: false` while still returning `stats`. Return 404 only when the item is unknown to both the provider and our DB (no ratings/shelves/activity and provider 404).
- **Rationale**: Satisfies FR-012/SC-005 (community sections render during provider outages). One round-trip keeps the page simple and fast.
- **Alternatives considered**: Two endpoints (detail + stats) — rejected as extra round-trips for no benefit; the page always needs both.

## Decision: Community aggregates from existing tables (no new schema)

- **Decision**: Compute in `ItemStatsService` via Prisma:
  - *Rating aggregate*: `aggregate` over `Rating` where `(mediaType, providerId)` → `_avg.stars`, `_count`. Average shown to 1 decimal; empty state when count 0.
  - *Shelf counts*: `groupBy` `LibraryItem` by `shelf` where `(mediaType, providerId)` → count of rows (one per user, so rows == distinct users). Zero-fill shelves with no rows.
  - *Recent activity*: `Activity` where snapshot `(mediaType, providerId)` matches, excluding deleted, ordered `createdAt desc`, take ~10; project author + createdAt + note/update text.
- **Rationale**: All inputs already exist (Rating 001, LibraryItem 005, Activity 006 with snapshot columns). No migration; queries are bounded and indexable on `(mediaType, providerId)`.
- **Alternatives considered**: Denormalized counters on an item record (rejected — premature; spec allows eventual consistency and the row counts are cheap at this scale).

## Decision: Stats freshness — request-time queries, optionally cached briefly

- **Decision**: Compute stats per request (bounded queries). If load warrants, wrap in a short Redis TTL (~60s) keyed `item-stats:{mediaType}:{providerId}`. Spec permits eventual consistency within a short window.
- **Rationale**: Keeps the user's own freshly-changed shelf/rating visible quickly while bounding DB cost. Start without the stats cache; add only if measured need.

## Decision: Search results persist on back-navigation (FR-014)

- **Decision**: Move the Search page's submitted `(category, query)` into the URL query string (`/search?category=books&q=dune`) via `useSearchParams`; results come from the TanStack Query cache keyed by `(category, query)`. Returning from an item restores the URL and the cached results render immediately.
- **Rationale**: Local `useState` resets on unmount (the current bug). URL state + the existing query cache restore the populated results without refetch; also makes a search shareable. Set TanStack `gcTime` long enough to survive the round-trip.
- **Alternatives considered**: A React context/store holding last search (rejected — heavier, non-shareable); keeping `<Search>` mounted (rejected — fights the router).

## Decision: Shared `ItemControls` component to avoid drift

- **Decision**: Extract the item action cluster (shelf select, "I'm reading/listening to this" + share bridge, Recommend, star rating) into a reusable `ItemControls` used by the item page; the existing cards may adopt it incrementally. Controls reuse existing service hooks (`useAddToLibrary`, `useLibraryShelves`, `useRecommend`, `useRatings`/`useSetRating`/`useClearRating`).
- **Rationale**: Parity across card and page (SC-003) without duplicating logic; one place to keep behavior consistent (e.g., concurrency guard, clear-on-reclick rating).
- **Alternatives considered**: Reimplement controls inline on the page (rejected — duplication and drift risk).

## Decision: Navigation entry points

- **Decision**: A small `ItemLink` wraps cover/title in Discover, Search, My Library, and feed `ActivityCard`, routing to `/item/:mediaType/:providerId`. Activity cards link only when a `providerId` is present.
- **Rationale**: FR-002 requires single-click access from all lists; isolating the link target in one component keeps routes consistent.

## Open questions

None — all spec assumptions resolved. iTunes `lookup` entity mapping (music/audiobook/podcast) and Google Books volume mapping reuse the normalization already proven in the trending/search adapters.
