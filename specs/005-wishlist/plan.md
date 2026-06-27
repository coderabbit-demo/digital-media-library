# Implementation Plan: Wishlist (005)

## Summary

A personal, **private** wishlist: an "Add to Wishlist" action on every media item
(Discover + Search), a dedicated all-media Wishlist page with a media-type filter,
idempotent add, owner-only remove, and "start an activity" from a wishlist item.
Populates the home `wishlisted` count (placeholder since 002). Local-data feature
— no external providers (items are snapshotted on add).

## Technical Context

- **Stack**: unchanged (React/Vite MD3, Fastify/Node 22, Prisma/CloudSQL, Redis).
- **No external providers, no new secrets.** Wishlist items are snapshots created
  from already-fetched Discover/Search items.

## Constitution Check

- **I (auth) + privacy**: every route requires auth; all queries are scoped to
  `currentUser.id` so a wishlist is visible only to its owner (FR-006, SC-002). PASS.
- **II (plain text)**: item text is snapshotted + rendered as plain text. PASS.
- **V (stateless)**: wishlist persists in PostgreSQL. PASS.
- **III**: no provider calls in this feature (local data only). N/A.

## Project Structure (new/changed)

```
packages/shared/src/index.ts        # WishlistItemDTO, WishlistPageDTO, createWishlistItemSchema
backend/prisma/schema.prisma        # + model WishlistItem (+ migration)
backend/src/services/wishlist.ts    # WishlistService (add idempotent / remove own / list+filter / count)
backend/src/api/wishlist.ts         # GET/POST /api/wishlist, DELETE /api/wishlist/:id
backend/src/services/home.ts        # wishlisted count from WishlistService
frontend/src/pages/Wishlist.tsx     # replaces WishlistPlaceholder; media-type filter
frontend/src/services/wishlist.ts   # useWishlist / useAddToWishlist / useRemoveFromWishlist / membership keys
frontend/src/components/DiscoverItemCard.tsx  # + "Add to Wishlist" action (Discover + Search)
```

## Phases

- **Phase 0–1**: research.md, data-model.md, contracts/openapi.yaml, quickstart.md (done).
- **Phase 2**: tasks.md, then implement.
