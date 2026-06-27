# Research: Search & Recommendations (004)

## 1. Search providers (keyless, via provider abstraction)

**Decision**: Books → Google Books volumes search; Music/Audiobooks/Podcasts →
Apple iTunes Search API.

- **Google Books** `GET https://www.googleapis.com/books/v1/volumes?q=<term>&printType=books&maxResults=N&country=US` (+ `key=` when `GOOGLE_BOOKS_API_KEY` set). Already used for Discover; same normalization (title, authors[0], imageLinks.thumbnail, id). Anonymous quota is shared and low (429s observed) → the configured key raises it.
- **iTunes Search API** `GET https://itunes.apple.com/search?term=<term>&media=<m>&entity=<e>&limit=N&country=US`, keyless, no OAuth. Verified live: music (`media=music&entity=album`), podcasts (`media=podcast`), audiobooks (`media=audiobook`) all return results. Normalize: `collectionName`/`trackName` → title, `artistName` → creator, `artworkUrl100` → coverUrl, `collectionId`/`trackId` → providerId. Same Apple family as the 003 RSS feeds.

**Rationale**: Keyless + already-in-use ecosystem; consistent with the 003 Apple
pivot; no new secrets. **Alternatives**: Spotify (rejected in 003 — auth/deprecation);
a local catalog (out of scope per spec).

## 2. Caching / refresh cadence (Principle III, SC-003)

**Decision**: `SearchService` does cache-aside keyed by
`search:{mediaType}:{normalizedQuery}` (query lowercased + trimmed + whitespace-
collapsed), TTL `SEARCH_TTL_SECONDS` (default 1h). Repeat queries within TTL never
hit the provider → satisfies SC-003.

Failure handling distinguishes two cases:
- **Provider failure** propagates as an error so the UI can show a distinct
  "search failed / try again" state (search has no "last known good" snapshot
  like trending).
- **A genuine zero-result query** returns an empty list → the UI shows the clear
  empty state.
- **Cache access is best-effort**: a Redis get/set failure is swallowed so it
  never discards an otherwise-successful provider result.

## 3. Recommendation data + idempotency

**Decision**: A `Recommendation` row stores a snapshot of the media item (so the
home region renders without re-fetching providers — mirrors how activities store
title/author). Unique on `(userId, mediaType, providerId)` makes add idempotent
(FR-006); create uses upsert. Remove is owner-scoped `deleteMany({ id, userId })`
(FR-005). Home lists community-wide recent recommendations (most recent first).

**Rationale**: Snapshotting avoids provider calls on the local-only home payload
(consistent with 002 FR-006) and keeps recommendations stable even if upstream
catalog changes.

## 4. Secrets

No new secrets. Books search reuses `GOOGLE_BOOKS_API_KEY` (optional); all Apple
search is keyless.

## 5. Frontend integration

- "Recommend" lives on `DiscoverItemCard` (shared by Discover + Search) so FR-002
  is satisfied in both surfaces with one component.
- The home `RecommendationsPanel` already renders `data.recommendations`; 004
  populates it and adds an owner-only remove control (current user via `useMe`).
- New top-nav "Search" entry + `/search` route.
