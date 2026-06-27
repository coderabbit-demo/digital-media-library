# Phase 1 Data Model: App Shell, Auth Gate & Home Page

This feature introduces **no new persistent entities and no schema changes**. It
reads existing tables from feature 001 and exposes an aggregated read model for the
home page.

## Persistent entities (existing, from feature 001 — unchanged)

- **UserProfile** — the signed-in user (id, displayName, avatarUrl). Used for the
  shell header and to scope the user's own items.
- **Activity** — "currently reading/listening" updates. Read two ways:
  - **Community feed**: global, keyset-paginated, newest-first (existing feed query).
  - **Own current items**: filtered by `userId = currentUser`, newest-first, small
    limit — for the home left column.
- **Session** — unchanged; used by the auth guard / `requireAuth`.

No migrations are required for this feature.

## Read model (aggregated, not persisted)

`GET /api/home` assembles a single response from local DB reads:

- **HomeData**
  - `ownItems: ActivityDTO[]` — the current user's recent own activities (left column).
  - `counts: HomeCounts`
    - `currentlyOn: number` — count of the user's own current activities.
    - `wishlisted: number` — **0 placeholder** until feature 005 (wishlist) exists.
  - `recommendations: []` — always empty in this feature; populated by feature 004.

The community feed (center column) is fetched separately via the existing paginated
`GET /api/feed` (also a local DB read) — it is **not** embedded in `HomeData`, so the
proven feed pagination component is reused as-is.

### Validation / rules

- `GET /api/home` MUST require authentication (401 otherwise) and MUST scope
  `ownItems`/`currentlyOn` to the requesting user only (Principle IV).
- All activity text is returned and rendered as plain text (FR / Principle IV).
- The endpoint MUST read only local data (our DB) — no external content-provider
  calls (FR-006).
- `recommendations` and `counts.wishlisted` are intentionally inert placeholders so
  the home shell is complete before features 004/005 land.

## Shared DTOs (add to `packages/shared`)

- `HomeCounts`: `{ currentlyOn: number; wishlisted: number }`
- `HomeData`: `{ ownItems: ActivityDTO[]; counts: HomeCounts; recommendations: RecommendationDTO[] }` (no `feed` — the community feed is fetched via `GET /api/feed`)
  - `RecommendationDTO[]` is typed but always empty here; the concrete `RecommendationDTO`
    is finalized in feature 004 (a minimal placeholder type is acceptable now).

## Relationships

```text
UserProfile 1 ──< Activity        (own items: userId = currentUser)
Activity (all) ───> community feed (global, keyset)
```

No new relationships or tables.
