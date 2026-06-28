import type { MediaType } from '@dml/shared';

/**
 * A normalized provider lookup result for a single item (feature 007). Richer
 * than `TrendingItem`: carries the full synopsis, a genre list, and an optional
 * series/edition label. The API surfaces the subset defined by `ItemDetailDTO`.
 */
export interface ItemDetail {
  mediaType: MediaType;
  providerId: string;
  title: string;
  creator: string | null;
  coverUrl: string | null;
  description: string | null;
  genres: string[];
  providerUrl: string | null;
  series: string | null;
}

/**
 * Boundary to external providers for by-id item lookups (constitution Principle
 * III). One adapter per provider family; `ItemService` adds cache-aside on top.
 * An adapter returns `null` when the item does not exist, and throws on an
 * upstream failure (the service decides stale-fallback vs. surfacing the error).
 */
export interface ItemProvider {
  /** Stable adapter name for logging/diagnostics. */
  readonly name: string;
  /** Look up one item by its provider id, normalized. Null if not found; throws on failure. */
  getItem(providerId: string): Promise<ItemDetail | null>;
}
