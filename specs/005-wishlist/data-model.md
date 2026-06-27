# Data Model: My Library (005)

## New entity: LibraryItem

A media item a user saved, on exactly one shelf. Private to the owner; snapshotted.

| Field      | Type      | Notes                                             |
|------------|-----------|---------------------------------------------------|
| id         | uuid (PK) | generated                                         |
| userId     | uuid (FK) | → UserProfile.id, cascade on delete; the owner    |
| mediaType  | MediaType | book \| music \| audiobook \| podcast             |
| title      | String    | plain text, ≤ TITLE_MAX_LENGTH (300)              |
| creator    | String?   | author/artist/publisher, ≤ ITEM_AUTHOR_MAX_LENGTH |
| coverUrl   | String?   | provider artwork URL                              |
| providerId | String    | provider's stable id                              |
| shelf      | Shelf     | want \| current \| done \| dnf; default `want`    |
| createdAt  | DateTime  | timestamptz, default now()                        |
| updatedAt  | DateTime  | timestamptz, set on move                          |

- **Shelf enum**: `want` / `current` / `done` / `dnf`. Each item is on **exactly one**
  shelf (mutually exclusive); "All" is a query-time union, not a stored value.
- **Unique**: `(userId, mediaType, providerId)` → idempotent add (FR-007).
- **Index**: `(userId, createdAt desc)` for the owner's recent-first list.
- **Prisma**: `@@map("library_item")`, snake_cased columns; migration
  `rename_wishlist_to_library_add_shelves` (renames `wishlist_item` → `library_item`,
  adds `shelf` default `want` and `updated_at`; prior wishlist items become `want`).

## DTOs (`packages/shared`)

- `LibraryItemDTO { id, mediaType, title, itemAuthor, coverUrl, providerId, shelf, createdAt }`
- `LibraryPageDTO { items: LibraryItemDTO[] }`
- `createLibraryItemSchema = { mediaType, title (1..300), creator? (≤200),
  coverUrl? (url|null), providerId, shelf? }` (zod; `shelf` optional, defaults to `want`).
- `updateLibraryItemSchema = { shelf }` (zod; the move payload — `shelf` is one of
  `want` / `current` / `done` / `dnf`).

## Referenced entities

- **UserProfile** (001) — the owner.
- **Activity** (001) — moving an item to Currently Reading can seed one (existing
  compose flow; offered, never automatic).
