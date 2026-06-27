import type { TrendingItem } from './content-provider.js';

/**
 * Boundary to external search providers (constitution Principle III). One adapter
 * per media category; `SearchService` adds cache-aside on top. An adapter throws
 * on upstream failure; the service converts that into an empty result set.
 */
export interface SearchProvider {
  /** Stable adapter name for logging/diagnostics. */
  readonly name: string;
  /** Search up to `limit` items matching `query`, normalized. Throws on failure. */
  search(query: string, limit: number): Promise<TrendingItem[]>;
}
