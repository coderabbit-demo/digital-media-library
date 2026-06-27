# Research: My Library (005)

## 1. Shelves model

**Decision**: A `LibraryItem` row carries a **`Shelf` enum** (`want` / `current` /
`done` / `dnf`, default `want`), and each item sits on **exactly one** shelf
(mutually exclusive). "All" is a query-time **union view**, not a stored shelf.
This supersedes the flat wishlist: the former wishlist is now the **Want to Read**
shelf. Listing supports `?shelf=` and `?mediaType=` filters, independently.

**Rationale**: A single enum keeps each item on one shelf, makes "move" a single
`PATCH` (no rows added/removed), and keeps the list query simple — a shelf view is
just a `where shelf = …`, and "All" is the absence of that clause.

## 2. Media-aware labels

**Decision**: Shelves are stored generically (`want` / `current` / `done` / `dnf`)
and the **UI renders media-aware labels**: "Want to Read" / "Read" for books vs.
"Want to Listen" / "Listened" for music, audiobooks, and podcasts; "Currently
Reading" / "Currently Listening" for `current`; "Did Not Finish" for `dnf`.

**Rationale**: Storing the generic shelf keeps the data model media-agnostic and
stable, while the label mapping lives in the UI where the media type is already known.

## 3. Bridge to the activity feed (not auto-post)

**Decision**: The **library shelf is the source of truth**. Moving an item to the
**Currently Reading** shelf *offers* to share a "currently reading/listening"
activity to the feed, reusing the existing 001 compose flow. Shelves never
auto-post; sharing is an explicit, optional step. The feed / Activity model (001)
is **unchanged**.

**Rationale**: Keeps the library and the feed decoupled — the library is the durable,
private record; the feed stays an intentional, user-authored stream. Reusing the
compose flow avoids any new posting path.

## 4. Storage & privacy (private by construction)

**Decision**: All reads/writes are scoped to `currentUser.id`; there is no
cross-user read path, so libraries are **private by construction** (FR-008, SC-002).
Unique `(userId, mediaType, providerId)` makes add idempotent (FR-007). Move
(`PATCH`) and remove (`DELETE`) are owner-only.

## 5. Snapshot rationale

**Decision**: A `LibraryItem` snapshots the media item (`mediaType`, `title`,
`creator`, `coverUrl`, `providerId`) on add.

**Rationale**: Snapshotting keeps the My Library page a local-only DB read (no
provider calls), consistent with the home payload, and stable if upstream catalog
data changes.

## 6. Filtering & "already saved" indication (FR-007)

**Decision**: The My Library page is one all-media collection with **shelf tabs**
(All + the four shelves) and a secondary **media-type filter**; both map to
`GET /api/library?shelf=&mediaType=`. The shared `DiscoverItemCard` shows
"Add to Library" vs. **"In Library ✓"**. Membership is derived from a single cached
`useLibrary()` query (a Set of `${mediaType}:${providerId}` keys), so the control
reflects the saved state on Discover and Search without per-card fetches.

## 7. Home count

`HomeService` fills `counts.wishlisted` from the **Want to Read** shelf count (was a
placeholder `0` since 002).

## 8. Migration

**Decision**: Migration `rename_wishlist_to_library_add_shelves` renames the old
`wishlist_item` table to `library_item` and adds the `shelf` column (default `want`)
and `updated_at`. Prior wishlist items become **Want to Read**, so no data is lost in
the refactor.

## 9. Secrets

None. The library is local-only; no external providers.
