# Quickstart: My Library (005)

## Prerequisites

- Features 001–004 running locally (`pnpm dev`), signed in. No new env.

## Apply the migration

```bash
corepack pnpm -C backend exec prisma migrate dev --name rename_wishlist_to_library_add_shelves
```

This renames `wishlist_item` → `library_item` and adds the `shelf` (default `want`)
and `updated_at` columns; any prior wishlist items become **Want to Read**.

## Manual validation

1. **Add → Want to Read (US1)**: From a Discover or Search item, click **Add to
   Library** → control shows **In Library ✓**. Open the **My Library** page → the
   item is on the **Want to Read** shelf. The home "wishlisted" count (Want to Read)
   increments.
2. **Move shelves (US1)**: On the My Library page, use an item's shelf selector to
   move it (e.g., Want to Read → Read) → it appears only on the new shelf.
3. **Browse shelves (US1)**: Switch shelf tabs (All / Want to Read / Currently
   Reading / Read / Did Not Finish) → each tab shows only its shelf; **All** unions
   every shelf.
4. **Media-type filter (US1)**: With mixed media types saved, choose a media-type
   filter → only that type shows (independent of the selected shelf); clear → full
   list returns.
5. **Idempotent add (US1)**: Add the same item again → not duplicated; control shows
   it's already saved.
6. **Bridge share (US2)**: Move an item to **Currently Reading** → the app offers to
   share an activity → accept → compose opens pre-filled → submit → appears in the
   feed. Decline → nothing is posted and the item stays on Currently Reading.
7. **Remove (US1)**: Remove an item from the My Library page → it disappears.
8. **Privacy (US1)**: A library is only ever the current user's (all reads/writes are
   owner-scoped).
9. **Redirect**: Visiting the old `/wishlist` route redirects to `/library`.

## Automated checks

```bash
corepack pnpm -r test:unit
corepack pnpm -C backend exec vitest run tests/contract/library.test.ts
corepack pnpm -C backend exec vitest run tests/unit/library.test.ts
corepack pnpm -w lint && corepack pnpm -r build
```

See `contracts/openapi.yaml` and `data-model.md`.
