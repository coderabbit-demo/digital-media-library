# Phase 1 Data Model: Item Detail Page

No new database tables or migrations. The feature reads from existing entities and introduces transport DTOs only.

## Existing entities consumed (read-only)

- **Rating** (001): `(userId, mediaType, providerId, stars)`. Source for the rating aggregate. Indexed/uniqued on `(userId, mediaType, providerId)`; aggregate filters on `(mediaType, providerId)`.
- **LibraryItem** (005): `(userId, mediaType, providerId, shelf, …)`, one row per user per item. Source for per-shelf user counts (row count per shelf == distinct users).
- **Activity** (001/006): feed updates with item snapshot columns `(mediaType, providerId, title, coverUrl, …)`, `note`, `createdAt`, soft-delete/`deletedAt` semantics, and `author`. Source for recent activity referencing the item.

> Recommended index check (planning note): ensure `(mediaType, providerId)` is efficiently queryable on `Rating`, `LibraryItem`, and `Activity`. Add Prisma `@@index([mediaType, providerId])` where missing; counts/lookups must stay bounded (Principle V). This is an index-only change, not a data migration.

## Provider-sourced value object (not persisted)

- **ItemDetail** — normalized provider lookup result:
  - `mediaType: MediaType`
  - `providerId: string`
  - `title: string`
  - `creator: string | null`
  - `coverUrl: string | null`
  - `description: string | null` (synopsis)
  - `genres: string[]` (empty when provider supplies none)
  - `providerUrl: string | null` (http(s) only)
  - `series: string | null` (series/edition label when available)

## Transport DTOs (`packages/shared`)

- **ItemDetailDTO**: mirrors `ItemDetail` above (the client-safe subset).

- **ShelfCountsDTO**: `{ want: number; current: number; done: number; dnf: number }` (zero-filled).

- **ItemActivityDTO**: `{ id: string; author: ActivityAuthorDTO; note: string | null; createdAt: string }` — minimal projection for the recent-activity list (reuses `ActivityAuthorDTO`).

- **ItemStatsDTO**:
  - `ratingAverage: number | null` (null when no ratings; one-decimal formatting is a display concern)
  - `ratingCount: number`
  - `shelfCounts: ShelfCountsDTO`
  - `recentActivity: ItemActivityDTO[]` (newest first, capped, default ≤ 10)

- **ItemPageDTO**: `{ item: ItemDetailDTO | null; detailAvailable: boolean; stats: ItemStatsDTO }`
  - `item` is null / `detailAvailable=false` when the provider lookup fails but the item is otherwise known (stats still returned).

## Validation & rules

- `mediaType` validated against the existing `MediaType` enum; unknown → 400.
- `providerId` non-empty string; format is provider-specific (no app-side schema beyond non-empty).
- All string fields rendered as plain text on the client (FR-011); URLs validated as http(s) before linking (existing `httpUrl()` helper).
- 404 only when the provider cannot resolve the item AND no local rows reference it; otherwise 200 with whatever is available.

## State / transitions

The page itself is read-only for detail/stats. Mutations occur via the existing, already-authorized endpoints (shelf add/move 005, rating upsert/clear 001, recommend create 004); after a successful mutation the client invalidates the item query (and the relevant existing caches) so personal controls and counts refresh.
