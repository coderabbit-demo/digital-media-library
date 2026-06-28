# Quickstart & Validation: Item Detail Page

Prerequisites: local Postgres + Redis running (the existing docker containers), backend and frontend dev servers, and a signed-in session. See `specs/005-wishlist/quickstart.md` for the base setup.

## Run

```bash
corepack pnpm -C backend dev      # API
corepack pnpm -C frontend dev     # SPA (http://localhost:5173)
```

## Validate

### US1 — View an item (P1)

1. From Discover (`/books`), click a card's cover or title → lands on `/item/book/{providerId}` showing cover, title, creator, media badge, synopsis with "show more", and genres.
2. Copy the URL, open it in a fresh tab (cold load) → same item renders (deep-link, FR-001/SC-002).
3. Visit `/item/book/__nope__` → "we couldn't find this item" state, with a path back to browsing.
4. Open an item whose provider has no genres → no empty genres label.

### US2 — Act on the item (P1)

1. Pick a shelf → item appears on that shelf in `/library`; control reflects the new shelf.
2. Click "I'm reading/listening to this" → item shelved as Currently Reading and the share-update overlay opens.
3. Click a star → rating saved; reload → rating persists; click the same star → rating clears.
4. Click Recommend → appears in the home recommendations; control shows "Recommended ✓".
5. As a second user, rate/shelve the same item → counts move but your personal controls are independent.

### US3 — Community context (P2)

1. With ratings from several users, the page shows the average (one decimal) and rating count.
2. With shelf placements across users, per-shelf counts ("N currently reading", etc.) are shown.
3. With recent feed updates referencing the item, the recent-activity list shows author + relative time, newest first, capped at ~10.
4. For a brand-new item with no data, community sections show empty states (no fake zeros).
5. Simulate a provider outage (item detail lookup fails) → community sections still render (SC-005).

### FR-014 — Search back-navigation

1. Go to `/search`, search "dune", get results.
2. Click a result → item page opens.
3. Press the browser back button → the search query and results are still shown (not reset). The URL is `/search?...` with the query preserved.

## Automated gates

```bash
corepack pnpm -C backend test         # contract (items endpoint) + integration (stats, provider-failure)
corepack pnpm -C frontend test        # ItemPage, SearchBackNav, link wiring
corepack pnpm -w lint
corepack pnpm -C frontend build && corepack pnpm -C backend build
```

Expected: new contract test asserts the `ItemPageDTO` shape and 404 semantics; integration tests assert rating average/count, per-shelf counts, recent-activity ordering/cap, and that stats return when the provider lookup throws; frontend tests assert render of detail + community sections, plain-text rendering of an injection payload (SC-006), and that returning from an item preserves search results (SC-007).
