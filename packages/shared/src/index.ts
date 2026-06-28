import { z } from 'zod';

/** Limits and defaults shared across the API and UI. */
export const RATE_LIMIT_POSTS_PER_MINUTE = 10;
export const FEED_DEFAULT_LIMIT = 20;
export const FEED_MAX_LIMIT = 50;
export const TITLE_MAX_LENGTH = 300;
export const ITEM_AUTHOR_MAX_LENGTH = 200;
/** Max length of an author note on an update and of a reply body (feature 006). */
export const NOTE_MAX_LENGTH = 1000;
export const REPLY_MAX_LENGTH = 1000;
/** Per-user reply rate limit — matches the posting limit (feature 006). */
export const RATE_LIMIT_REPLIES_PER_MINUTE = 10;
/** Star rating bounds (UI refresh). */
export const RATING_MIN = 1;
export const RATING_MAX = 5;

/**
 * A snapshot URL (cover art or provider link). Validates URL format and restricts
 * the scheme to http(s) so client-supplied snapshots can't smuggle javascript:/
 * data: URIs into an <img src> or <a href>.
 */
const httpUrl = () =>
  z
    .string()
    .trim()
    .url()
    .max(2048)
    .refine((u) => /^https?:\/\//i.test(u), { message: 'URL must use http(s)' });

/** Media types a user can be reading/listening to. */
export const MEDIA_TYPES = ['book', 'music', 'audiobook', 'podcast'] as const;
export const mediaTypeSchema = z.enum(MEDIA_TYPES);
export type MediaType = z.infer<typeof mediaTypeSchema>;

/** Request body for creating an activity update. */
export const createActivitySchema = z.object({
  mediaType: mediaTypeSchema,
  title: z.string().trim().min(1).max(TITLE_MAX_LENGTH),
  itemAuthor: z.string().trim().max(ITEM_AUTHOR_MAX_LENGTH).optional().nullable(),
  // Optional free-text author note (feature 006), plain text.
  note: z.string().trim().max(NOTE_MAX_LENGTH).optional().nullable(),
  // Optional snapshot of the source item (when started from Discover/Search/Library)
  // so feed cards can show cover art, a synopsis, and a provider link (UI refresh).
  // URLs are http(s)-only and text is plain text — these are user-supplied snapshots.
  coverUrl: httpUrl().optional().nullable(),
  providerId: z.string().trim().max(512).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  providerUrl: httpUrl().optional().nullable(),
});
export type CreateActivityInput = z.infer<typeof createActivitySchema>;

/** Query params for the feed endpoint. */
export const feedQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(FEED_MAX_LIMIT).default(FEED_DEFAULT_LIMIT),
});
export type FeedQuery = z.infer<typeof feedQuerySchema>;

/** Public profile shape (never exposes google_sub, email, or session ids). */
export interface ProfileDTO {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ActivityAuthorDTO {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ActivityDTO {
  id: string;
  author: ActivityAuthorDTO;
  mediaType: MediaType;
  title: string;
  itemAuthor: string | null;
  /** Optional author note/comment shown with the update (feature 006). */
  note: string | null;
  /** Number of (non-deleted) replies in this update's conversation (feature 006). */
  replyCount: number;
  /** Snapshot of the source item for richer feed cards (UI refresh); null when hand-typed. */
  coverUrl: string | null;
  providerId: string | null;
  description: string | null;
  providerUrl: string | null;
  /** Number of likes on this update, and whether the requesting user liked it (UI refresh). */
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
  /** True when the requesting user authored this activity. */
  canDelete: boolean;
}

/** A reply in an update's conversation (feature 006). Plain text only. */
export interface ReplyDTO {
  id: string;
  activityId: string;
  /** The reply this answers, or null for a top-level reply. */
  parentId: string | null;
  author: ActivityAuthorDTO;
  /** Empty string when `deleted` is true (rendered as a tombstone). */
  body: string;
  createdAt: string;
  /** True when soft-deleted (kept as a tombstone because it has child replies). */
  deleted: boolean;
  /** True when the requesting user authored this reply (and it isn't deleted). */
  canDelete: boolean;
}

/** An update's full conversation as a flat list (client builds the tree from parentId). */
export interface ReplyThreadDTO {
  activityId: string;
  replies: ReplyDTO[];
  /** Count of non-deleted replies. */
  count: number;
}

/** Request body for creating a reply (feature 006). Plain text only. */
export const createReplySchema = z.object({
  body: z.string().trim().min(1).max(REPLY_MAX_LENGTH),
  // A malformed parentId is a client error (400), not a server error.
  parentId: z.string().uuid().optional().nullable(),
});
export type CreateReplyInput = z.infer<typeof createReplySchema>;

export interface FeedPageDTO {
  items: ActivityDTO[];
  nextCursor: string | null;
}

export interface ErrorDTO {
  error: string;
  message: string;
}

/** Counts shown in the home left column. `wishlisted` is 0 until feature 005. */
export interface HomeCounts {
  currentlyOn: number;
  wishlisted: number;
}

/**
 * A user-initiated recommendation surfaced on the home page (feature 004).
 * Populated solely by user "Recommend" actions — never auto-generated.
 */
export interface RecommendationDTO {
  id: string;
  recommender: ActivityAuthorDTO;
  mediaType: MediaType;
  title: string;
  itemAuthor: string | null;
  coverUrl: string | null;
  providerId: string;
  createdAt: string;
  /** True when the requesting user made this recommendation (can remove it). */
  canRemove: boolean;
}

/**
 * Aggregated, local-only home payload (feature 002). The community feed is fetched
 * separately via the existing paginated `/feed` endpoint; both are local DB reads.
 */
export interface HomeData {
  /**
   * The user's "Currently reading/listening" list — their My Library items on the
   * `current` shelf, so it always matches My Library (feature 005/UI refresh).
   */
  current: LibraryItemDTO[];
  counts: HomeCounts;
  recommendations: RecommendationDTO[];
}

/** Discover route segments and their mapping to the singular MediaType. */
export const DISCOVER_CATEGORIES = ['books', 'music', 'audiobooks', 'podcasts'] as const;
export type DiscoverCategory = (typeof DISCOVER_CATEGORIES)[number];

const CATEGORY_TO_MEDIA: Record<DiscoverCategory, MediaType> = {
  books: 'book',
  music: 'music',
  audiobooks: 'audiobook',
  podcasts: 'podcast',
};

/** Map a Discover route segment to a MediaType, or null if unknown. */
export function mediaTypeForCategory(segment: string): MediaType | null {
  // Guard against inherited keys (e.g. "constructor", "toString") matching.
  if (!Object.prototype.hasOwnProperty.call(CATEGORY_TO_MEDIA, segment)) return null;
  return CATEGORY_TO_MEDIA[segment as DiscoverCategory];
}

/** A normalized trending item surfaced in a Discover view. */
export interface TrendingItemDTO {
  mediaType: MediaType;
  title: string;
  /** Author (books/audiobooks), artist (music), or publisher (podcasts). */
  creator: string | null;
  coverUrl: string | null;
  /** The source provider's stable identifier for the item. */
  providerId: string;
  /** Genre/list this item came from (e.g., an NYT list name, Google subject, or Apple genre); null when the source has no genre. */
  genre: string | null;
  /** Short synopsis when the provider supplies one; null otherwise. */
  description: string | null;
  /** Canonical URL to the item on the provider (for a "Preview/View" link); null if none. */
  providerUrl: string | null;
}

/** A page of trending items for one category. */
export interface DiscoverPageDTO {
  category: MediaType;
  items: TrendingItemDTO[];
  /** True when served from the last-known-good snapshot (results may be out of date). */
  stale: boolean;
}

/** Max length of a search query string. */
export const SEARCH_QUERY_MAX_LENGTH = 200;

/** Search results for one category + query (feature 004). */
export interface SearchPageDTO {
  category: MediaType;
  query: string;
  items: TrendingItemDTO[];
}

/** Request body for creating a recommendation (feature 004). Plain text only. */
export const createRecommendationSchema = z.object({
  mediaType: mediaTypeSchema,
  title: z.string().trim().min(1).max(TITLE_MAX_LENGTH),
  creator: z.string().trim().max(ITEM_AUTHOR_MAX_LENGTH).optional().nullable(),
  coverUrl: httpUrl().optional().nullable(),
  providerId: z.string().trim().min(1).max(512),
});
export type CreateRecommendationInput = z.infer<typeof createRecommendationSchema>;

/**
 * Library shelves (feature 005, "My Library"). Stored generically; the UI renders
 * media-aware labels (e.g. "Want to Read" for books, "Want to Listen" for music).
 * Exactly one shelf per item. "All" is a view, not a stored value.
 */
export const SHELVES = ['want', 'current', 'done', 'dnf'] as const;
export const shelfSchema = z.enum(SHELVES);
export type Shelf = z.infer<typeof shelfSchema>;

/** An item in the current user's private library (feature 005). */
export interface LibraryItemDTO {
  id: string;
  mediaType: MediaType;
  title: string;
  itemAuthor: string | null;
  coverUrl: string | null;
  providerId: string;
  shelf: Shelf;
  /** Snapshot synopsis + provider link (UI refresh), so library-started activities stay rich. */
  description: string | null;
  providerUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The current user's library page (feature 005). */
export interface LibraryPageDTO {
  items: LibraryItemDTO[];
}

/** Request body for adding a library item (feature 005). Plain text only. */
export const createLibraryItemSchema = z.object({
  mediaType: mediaTypeSchema,
  title: z.string().trim().min(1).max(TITLE_MAX_LENGTH),
  creator: z.string().trim().max(ITEM_AUTHOR_MAX_LENGTH).optional().nullable(),
  coverUrl: httpUrl().optional().nullable(),
  providerId: z.string().trim().min(1).max(512),
  // Snapshot synopsis + provider link, so library-started activities stay rich.
  description: z.string().trim().max(5000).optional().nullable(),
  providerUrl: httpUrl().optional().nullable(),
  // Optional target shelf; defaults to "want" (Want to Read) when omitted.
  shelf: shelfSchema.optional(),
});
export type CreateLibraryItemInput = z.infer<typeof createLibraryItemSchema>;

/** Request body for moving a library item to a different shelf (feature 005). */
export const updateLibraryItemSchema = z.object({ shelf: shelfSchema });
export type UpdateLibraryItemInput = z.infer<typeof updateLibraryItemSchema>;

/** A user's star rating of an item (UI refresh). */
export interface RatingDTO {
  mediaType: MediaType;
  providerId: string;
  stars: number;
}

/** Request body for setting a star rating (UI refresh). Upsert per user+item. */
export const upsertRatingSchema = z.object({
  mediaType: mediaTypeSchema,
  providerId: z.string().trim().min(1).max(512),
  stars: z.number().int().min(RATING_MIN).max(RATING_MAX),
  // Snapshot for a future "your ratings" view.
  title: z.string().trim().min(1).max(TITLE_MAX_LENGTH),
  creator: z.string().trim().max(ITEM_AUTHOR_MAX_LENGTH).optional().nullable(),
  coverUrl: httpUrl().optional().nullable(),
});
export type UpsertRatingInput = z.infer<typeof upsertRatingSchema>;

/* ============================================================================
 * Item detail page (feature 007)
 * ========================================================================== */

/** Builds the client route for an item detail page. */
export function itemPathFor(mediaType: MediaType, providerId: string): string {
  return `/item/${mediaType}/${encodeURIComponent(providerId)}`;
}

/** Provider-sourced detail for a single item (feature 007). */
export interface ItemDetailDTO {
  mediaType: MediaType;
  providerId: string;
  title: string;
  creator: string | null;
  coverUrl: string | null;
  /** Full synopsis/description when the provider supplies one. */
  description: string | null;
  /** Genre tags when the provider supplies them; empty array otherwise. */
  genres: string[];
  /** Canonical URL to the item on the provider; null if none. */
  providerUrl: string | null;
  /** Series/edition label when the provider offers one; null otherwise. */
  series: string | null;
}

/** Per-shelf counts of distinct users holding an item (feature 007). */
export interface ShelfCountsDTO {
  want: number;
  current: number;
  done: number;
  dnf: number;
}

/** A recent feed update referencing an item (feature 007). */
export interface ItemActivityDTO {
  id: string;
  author: ActivityAuthorDTO;
  /** The author's note/comment (plain text); null when none. */
  note: string | null;
  createdAt: string;
}

/** Community aggregates for an item, computed from our own data (feature 007). */
export interface ItemStatsDTO {
  /** Mean stars; null when there are no ratings. */
  ratingAverage: number | null;
  ratingCount: number;
  shelfCounts: ShelfCountsDTO;
  /** Recent activity referencing the item, newest first, capped. */
  recentActivity: ItemActivityDTO[];
}

/** Maximum number of recent activities surfaced on an item page. */
export const ITEM_ACTIVITY_LIMIT = 10;

/** The full payload for an item detail page (feature 007). */
export interface ItemPageDTO {
  /** Provider detail; null when the lookup failed but the item is otherwise known. */
  item: ItemDetailDTO | null;
  /** False when the provider detail lookup failed (stats are still present). */
  detailAvailable: boolean;
  stats: ItemStatsDTO;
}
