import { z } from 'zod';

/** Limits and defaults shared across the API and UI. */
export const RATE_LIMIT_POSTS_PER_MINUTE = 10;
export const FEED_DEFAULT_LIMIT = 20;
export const FEED_MAX_LIMIT = 50;
export const TITLE_MAX_LENGTH = 300;
export const ITEM_AUTHOR_MAX_LENGTH = 200;

/** Media types a user can be reading/listening to. */
export const MEDIA_TYPES = ['book', 'music', 'audiobook', 'podcast'] as const;
export const mediaTypeSchema = z.enum(MEDIA_TYPES);
export type MediaType = z.infer<typeof mediaTypeSchema>;

/** Request body for creating an activity update. */
export const createActivitySchema = z.object({
  mediaType: mediaTypeSchema,
  title: z.string().trim().min(1).max(TITLE_MAX_LENGTH),
  itemAuthor: z.string().trim().max(ITEM_AUTHOR_MAX_LENGTH).optional().nullable(),
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
  createdAt: string;
  /** True when the requesting user authored this activity. */
  canDelete: boolean;
}

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
  ownItems: ActivityDTO[];
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
  coverUrl: z.string().trim().url().max(2048).optional().nullable(),
  providerId: z.string().trim().min(1).max(512),
});
export type CreateRecommendationInput = z.infer<typeof createRecommendationSchema>;

/** An item saved on the current user's private wishlist (feature 005). */
export interface WishlistItemDTO {
  id: string;
  mediaType: MediaType;
  title: string;
  itemAuthor: string | null;
  coverUrl: string | null;
  providerId: string;
  createdAt: string;
}

/** The current user's wishlist (feature 005). */
export interface WishlistPageDTO {
  items: WishlistItemDTO[];
}

/** Request body for adding a wishlist item (feature 005). Plain text only. */
export const createWishlistItemSchema = z.object({
  mediaType: mediaTypeSchema,
  title: z.string().trim().min(1).max(TITLE_MAX_LENGTH),
  creator: z.string().trim().max(ITEM_AUTHOR_MAX_LENGTH).optional().nullable(),
  coverUrl: z.string().trim().url().max(2048).optional().nullable(),
  providerId: z.string().trim().min(1).max(512),
});
export type CreateWishlistItemInput = z.infer<typeof createWishlistItemSchema>;
