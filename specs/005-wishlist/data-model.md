# Data Model: Wishlist (005)

## New entity: WishlistItem

A media item a user saved for later. Private to the owner; snapshotted.

| Field      | Type      | Notes                                             |
|------------|-----------|---------------------------------------------------|
| id         | uuid (PK) | generated                                         |
| userId     | uuid (FK) | → UserProfile.id, cascade on delete; the owner    |
| mediaType  | MediaType | book \| music \| audiobook \| podcast             |
| title      | String    | plain text, ≤ TITLE_MAX_LENGTH (300)              |
| creator    | String?   | author/artist/publisher, ≤ ITEM_AUTHOR_MAX_LENGTH |
| coverUrl   | String?   | provider artwork URL                              |
| providerId | String    | provider's stable id                              |
| createdAt  | DateTime  | timestamptz, default now()                        |

- **Unique**: `(userId, mediaType, providerId)` → idempotent add (FR-005).
- **Index**: `(userId, createdAt desc)` for the owner's recent-first list.
- **Prisma**: `@@map("wishlist_item")`, snake_cased columns; migration `add_wishlist_item`.

## DTOs (`packages/shared`)

- `WishlistItemDTO { id, mediaType, title, itemAuthor, coverUrl, providerId, createdAt }`
- `WishlistPageDTO { items: WishlistItemDTO[] }`
- `createWishlistItemSchema = { mediaType, title (1..300), creator? (≤200),
  coverUrl? (url|null), providerId }` (zod; same shape as the recommendation input).

## Referenced entities

- **UserProfile** (001) — the owner.
- **Activity** (001) — a wishlist item can seed one (existing compose flow).
