# Tasks: My Library (005)

## Phase 1: Setup & Foundational

- [X] T001 Add `LibraryItem` model + `Shelf` enum to backend/prisma/schema.prisma + migration `rename_wishlist_to_library_add_shelves` (rename `wishlist_item` → `library_item`, add `shelf` default `want` + `updated_at`)
- [X] T002 [P] Add `LibraryItemDTO` (with `shelf`), `LibraryPageDTO`, `createLibraryItemSchema` (optional `shelf`), `updateLibraryItemSchema` `{shelf}` to packages/shared/src/index.ts

## Phase 2: User Story 1 — Add to library & organize on shelves (P1)

- [X] T010 [US1] LibraryService (add idempotent → want / move shelf / remove own / list+filter by shelf+mediaType / want count) in backend/src/services/library.ts
- [X] T011 [US1] GET/POST /api/library + PATCH (move) + DELETE /api/library/:id in backend/src/api/library.ts
- [X] T012 [US1] Wire LibraryService into context + app.ts; home `wishlisted` count from the Want to Read shelf
- [X] T013 [P] [US1] My Library page (replace WishlistPlaceholder) with shelf tabs (All + 4 shelves) + media-type filter + per-item move + remove (frontend/src/pages/Library.tsx, App.tsx; `/wishlist` redirects to `/library`)
- [X] T014 [P] [US1] useLibrary / useAddToLibrary / useMoveLibraryItem / useRemoveFromLibrary + membership keys (frontend/src/services/library.ts)
- [X] T015 [US1] "Add to Library" action on DiscoverItemCard (adds to Want to Read; saved-state aware → "In Library ✓")
- [X] T016 [US1] Tests: backend unit (LibraryService) + contract (add/list/filter/move/remove/privacy/home count), shared schema, frontend (My Library page + add)

## Phase 3: User Story 2 — Share an activity when you start an item (P2)

- [X] T020 [US2] Bridge: moving an item to Currently Reading offers to share an activity (My Library page uses DiscoverItemCard onStartActivity / existing compose flow; no auto-post) + test

## Phase 4: Polish

- [X] T030 [P] Update README.md, AGENTS.md
- [X] T031 Run gates + live verify

## MVP

User Story 1 (add → Want to Read, shelves/move/filter/remove, private, home count) is the MVP.
