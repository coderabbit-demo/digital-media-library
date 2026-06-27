# Implementation Plan: My Library (005)

## Summary

A personal, **private** library (Goodreads-style shelves) that supersedes the flat
wishlist: an "Add to Library" action on every media item (Discover + Search) that
saves to the **Want to Read** shelf, a dedicated all-media My Library page with
shelf tabs (All + four shelves) and a media-type filter, idempotent add, **move**
between shelves, owner-only remove, and a **bridge to the activity feed** that
offers to share an activity when an item moves to Currently Reading. Populates the
home `wishlisted` count (now the Want to Read shelf count). Local-data feature —
no external providers (items are snapshotted on add).

## Technical Context

- **Stack**: unchanged (React/Vite MD3, Fastify/Node 22, Prisma/CloudSQL, Redis).
- **No external providers, no new secrets.** Library items are snapshots created
  from already-fetched Discover/Search items.

## Constitution Check

- **I (auth) + privacy**: every route requires auth; all queries are scoped to
  `currentUser.id` so a library is visible only to its owner (FR-008, SC-002). PASS.
- **II (plain text)**: item text is snapshotted + rendered as plain text. PASS.
- **V (stateless)**: the library persists in PostgreSQL. PASS.
- **III**: no provider calls in this feature (local data only). N/A.

## Data model

- **`LibraryItem`** (table `library_item`): snapshots the media item (`mediaType`,
  `title`, `creator`, `coverUrl`, `providerId`) plus `userId`, a **`Shelf` enum**
  (`want` / `current` / `done` / `dnf`, default `want`), `createdAt`, `updatedAt`.
- **Unique** `(userId, mediaType, providerId)` → idempotent add.
- Each item sits on **exactly one** shelf (mutually exclusive); "All" is a query-time
  union, not a stored shelf.
- **Migration `rename_wishlist_to_library_add_shelves`**: renames the old
  `wishlist_item` table to `library_item` and adds the `shelf` column (default
  `want`) and `updated_at`; prior wishlist items become **Want to Read**.

## API

- `GET /api/library?shelf=&mediaType=` — list the owner's items, filterable by shelf
  and/or media type (most recent first).
- `POST /api/library` — add (idempotent per user+item); body may include an optional
  `shelf` and otherwise defaults to `want`.
- `PATCH /api/library/:id` `{ shelf }` — **move** an item to another shelf (owner-only).
- `DELETE /api/library/:id` — remove (owner-only).

## UI

- Nav **"Wishlist" → "My Library"** at `/library`; the old `/wishlist` route
  redirects to `/library`.
- My Library page: **shelf tabs** (All + Want to Read / Currently Reading / Read /
  Did Not Finish) with media-aware labels, plus a secondary **media-type filter**.
  Each item has a **shelf selector** (move), **Remove**, and **start-activity**.
- Shared item card: **"Add to Wishlist" → "Add to Library"** (adds to Want to Read;
  shows **"In Library ✓"** once saved).

## Bridge to the activity feed (decision)

The **library shelf is the source of truth**. Moving an item to **Currently Reading**
*offers* to share an activity to the feed, reusing the existing 001 compose flow. The
feed / Activity model (001) is **unchanged**, and shelves do **not** auto-post —
sharing is always an explicit, optional step.

## Home count

`HomeService` fills `counts.wishlisted` from the **Want to Read** shelf count (was a
placeholder `0` since 002).

## Project Structure (new/changed)

```
packages/shared/src/index.ts        # LibraryItemDTO (with shelf), LibraryPageDTO, createLibraryItemSchema (optional shelf), updateLibraryItemSchema
backend/prisma/schema.prisma        # + model LibraryItem + Shelf enum (migration rename_wishlist_to_library_add_shelves)
backend/src/services/library.ts     # LibraryService (add idempotent / move shelf / remove own / list+filter / want count)
backend/src/api/library.ts          # GET/POST /api/library, PATCH/DELETE /api/library/:id
backend/src/services/home.ts        # wishlisted count from the Want to Read shelf
frontend/src/pages/Library.tsx      # replaces WishlistPlaceholder; shelf tabs + media-type filter + per-item move
frontend/src/services/library.ts    # useLibrary / useAddToLibrary / useMoveLibraryItem / useRemoveFromLibrary / membership keys
frontend/src/components/DiscoverItemCard.tsx  # + "Add to Library" action (Discover + Search)
```

## Phases

- **Phase 0–1**: research.md, data-model.md, contracts/openapi.yaml, quickstart.md (done).
- **Phase 2**: tasks.md, then implement.
