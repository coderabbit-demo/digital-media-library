import type { MediaType } from '@dml/shared';

/**
 * A normalized trending item produced by a provider adapter. Includes `provider`
 * for diagnostics; the API surfaces the subset defined by `TrendingItemDTO`.
 */
export interface TrendingItem {
  mediaType: MediaType;
  title: string;
  creator: string | null;
  coverUrl: string | null;
  providerId: string;
  provider: string;
  /** Genre/list the item came from (e.g., NYT list name, Google subject); null if none. */
  genre: string | null;
  /** Short synopsis/description when the provider supplies one; null otherwise. */
  description: string | null;
  /** Canonical URL to the item on the provider (for a "Preview/View" link); null if none. */
  providerUrl: string | null;
}

/**
 * The single boundary to external content providers (constitution Principle III).
 * Only modules under `backend/src/providers/` may talk to a provider; everything
 * else depends on this interface. An adapter throws when it cannot produce data
 * (e.g., missing credentials or an upstream error); `TrendingService` turns that
 * into a cached/stale/empty response.
 */
export interface ContentProvider {
  /** Stable adapter name for logging/diagnostics. */
  readonly name: string;
  /** Fetch up to `limit` trending items, normalized. Throws on failure. */
  getTrending(limit: number): Promise<TrendingItem[]>;
}
