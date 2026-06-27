# Research: Wishlist (005)

## 1. Storage & privacy

**Decision**: A `WishlistItem` row snapshots the media item (mediaType, title,
creator, coverUrl, providerId) plus the owner and `createdAt`. All reads/writes
are scoped to `currentUser.id`; there is no cross-user read path, so wishlists are
private by construction (FR-006, SC-002). Unique `(userId, mediaType, providerId)`
makes add idempotent (FR-005). Mirrors the 004 `Recommendation` shape/approach.

**Rationale**: Snapshotting keeps the Wishlist page a local-only DB read (no
provider calls), consistent with the home payload, and stable if upstream
catalog data changes.

## 2. Filtering

**Decision**: The Wishlist page is one all-media list with a client- and
server-supported media-type filter. `GET /api/wishlist?mediaType=<m>` filters
server-side; the UI offers an "All" + per-type selector. Clearing the filter
restores the full list (FR-003, SC-003).

## 3. "Already saved" indication (FR-005)

**Decision**: The shared `DiscoverItemCard` shows "Add to Wishlist" vs.
"Wishlisted ✓". Membership is derived from a single cached `useWishlist()` query
(a Set of `${mediaType}:${providerId}` keys), so the control reflects the saved
state on Discover and Search without per-card fetches.

## 4. Home count

`HomeService` fills `counts.wishlisted` from `WishlistService.count(userId)`
(was a placeholder `0` since 002).

## 5. Secrets

None. Wishlist is local-only; no external providers.
