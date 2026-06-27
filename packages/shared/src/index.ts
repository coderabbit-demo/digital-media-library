import { z } from 'zod';

/** Limits and defaults shared across the API and UI. */
export const RATE_LIMIT_POSTS_PER_MINUTE = 10;
export const FEED_DEFAULT_LIMIT = 20;
export const FEED_MAX_LIMIT = 50;
export const TITLE_MAX_LENGTH = 300;
export const ITEM_AUTHOR_MAX_LENGTH = 200;

/** Media types a user can be reading/listening to. */
export const MEDIA_TYPES = ['book', 'music', 'audiobook'] as const;
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
 * A user-initiated recommendation surfaced on the home page. Always an empty list
 * in feature 002; the recommendation system is delivered in feature 004 (this shape
 * may be refined there).
 */
export interface RecommendationDTO {
  id: string;
  recommender: ActivityAuthorDTO;
  mediaType: MediaType;
  title: string;
  itemAuthor: string | null;
  createdAt: string;
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
