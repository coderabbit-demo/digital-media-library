# Quickstart: Wishlist (005)

## Prerequisites

- Features 001–004 running locally (`pnpm dev`), signed in. No new env.

## Apply the migration

```bash
corepack pnpm -C backend exec prisma migrate dev --name add_wishlist_item
```

## Manual validation

1. **Add + view (US1)**: From a Discover or Search item, click **Add to Wishlist**
   → control shows **Wishlisted ✓**. Open the **Wishlist** page → the item is
   listed. The home "wishlisted" count increments.
2. **Filter (US1)**: With mixed media types saved, choose a media-type filter →
   only that type shows; choose **All** → full list returns.
3. **Idempotent add (US1)**: Add the same item again → not duplicated; control
   shows it's already saved.
4. **Remove (US1)**: Remove an item from the Wishlist page → it disappears.
5. **Privacy (US1)**: A wishlist is only ever the current user's (all reads are
   owner-scoped).
6. **Start activity (US2)**: From a wishlist item, **I'm reading/listening to this**
   → compose opens pre-filled → submit → appears in the feed.

## Automated checks

```bash
corepack pnpm -r test:unit
corepack pnpm -C backend exec vitest run tests/contract/wishlist.test.ts
corepack pnpm -w lint && corepack pnpm -r build
```

See `contracts/openapi.yaml` and `data-model.md`.
