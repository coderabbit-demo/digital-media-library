# Data Model: Search & Recommendations (004)

## New entity: Recommendation

A user-initiated endorsement of a media item, snapshotted so the home region
renders from local data only.

| Field       | Type        | Notes                                              |
|-------------|-------------|----------------------------------------------------|
| id          | uuid (PK)   | generated                                          |
| userId      | uuid (FK)   | → UserProfile.id, cascade on delete                |
| mediaType   | MediaType   | book \| music \| audiobook \| podcast              |
| title       | String      | plain text, ≤ TITLE_MAX_LENGTH (300)               |
| creator     | String?     | author/artist/publisher, ≤ ITEM_AUTHOR_MAX_LENGTH  |
| coverUrl    | String?     | provider artwork URL                               |
| providerId  | String      | provider's stable id for the item                  |
| createdAt   | DateTime    | timestamptz, default now()                         |

- **Unique**: `(userId, mediaType, providerId)` → add is idempotent (FR-006).
- **Index**: `(createdAt)` for recent-first listing.
- **Prisma**: `@@map("recommendation")`, columns snake_cased; new migration
  `add_recommendation`.

## Referenced entities (unchanged)

- **UserProfile** (001) — the recommender (shown as displayName/avatar).
- **Activity** (001) — a search/recommendation item can seed one (existing flow).
- **Trending/Media Item** (003) — `TrendingItemDTO` is the search-result shape.

## DTOs (`packages/shared`)

- `SearchPageDTO { category: MediaType; query: string; items: TrendingItemDTO[] }`
- `createRecommendationSchema` = `{ mediaType, title (1..300), creator? (≤200),
  coverUrl? (url|null), providerId }` (zod; plain text).
- `RecommendationDTO` (extends 002): `{ id, recommender: ActivityAuthorDTO,
  mediaType, title, itemAuthor, coverUrl, providerId, createdAt, canRemove }`
  (`canRemove` true when the requesting user made it).
