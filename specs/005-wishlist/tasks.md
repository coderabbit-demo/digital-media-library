# Tasks: Wishlist (005)

## Phase 1: Setup & Foundational

- [X] T001 Add `WishlistItem` model to backend/prisma/schema.prisma + migration `add_wishlist_item`
- [X] T002 [P] Add `WishlistItemDTO`, `WishlistPageDTO`, `createWishlistItemSchema` to packages/shared/src/index.ts

## Phase 2: User Story 1 — Add to wishlist & manage it (P1)

- [X] T010 [US1] WishlistService (add idempotent / remove own / list+filter / count) in backend/src/services/wishlist.ts
- [X] T011 [US1] GET/POST /api/wishlist + DELETE /api/wishlist/:id in backend/src/api/wishlist.ts
- [X] T012 [US1] Wire WishlistService into context + app.ts; home `wishlisted` count from it
- [X] T013 [P] [US1] Wishlist page (replace WishlistPlaceholder) with media-type filter + remove (frontend/src/pages/Wishlist.tsx, App.tsx)
- [X] T014 [P] [US1] useWishlist / useAddToWishlist / useRemoveFromWishlist + membership keys (frontend/src/services/wishlist.ts)
- [X] T015 [US1] "Add to Wishlist" action on DiscoverItemCard (saved-state aware)
- [X] T016 [US1] Tests: backend unit (WishlistService) + contract (add/list/filter/remove/privacy/home count), shared schema, frontend (Wishlist page + add)

## Phase 3: User Story 2 — Start activity from a wishlist item (P2)

- [X] T020 [US2] Wire compose pre-fill from a wishlist item (Wishlist page uses DiscoverItemCard onStartActivity) + test

## Phase 4: Polish

- [X] T030 [P] Update README.md, AGENTS.md
- [X] T031 Run gates + live verify

## MVP

User Story 1 (add → list/filter/remove, private, home count) is the MVP.
