import type { MediaType } from '@dml/shared';
import type { CacheService } from './cache.js';
import type { AppConfig } from '../config/index.js';
import type { TrendingItem } from '../providers/content-provider.js';
import type { SearchProvider } from '../providers/search-provider.js';

/**
 * Media search through the provider abstraction with cache-aside (Principle III).
 * Repeat queries for the same (mediaType, normalized query) within the TTL are
 * served from Redis without hitting the provider (feature 004, SC-003). On
 * provider failure, returns an empty result set (search has no stale semantics).
 */
export class SearchService {
  constructor(
    private readonly cache: CacheService,
    private readonly providers: Record<MediaType, SearchProvider>,
    private readonly config: AppConfig,
  ) {}

  /** Normalize a query for cache keying: trim, lowercase, collapse whitespace. */
  private normalize(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  async search(mediaType: MediaType, query: string, limit: number): Promise<TrendingItem[]> {
    const normalized = this.normalize(query);
    if (!normalized) return [];

    const cacheKey = `search:${mediaType}:${normalized}`;
    const cached = await this.cache.get<TrendingItem[]>(cacheKey);
    if (cached) return cached.slice(0, limit);

    try {
      // Cache a generous batch so different limits share one cached result.
      const items = await this.providers[mediaType].search(normalized, Math.max(limit, 20));
      await this.cache.set(cacheKey, items, this.config.SEARCH_TTL_SECONDS);
      return items.slice(0, limit);
    } catch {
      // Search has no last-known-good; surface an empty set and let the UI show
      // an empty/unavailable state rather than erroring.
      return [];
    }
  }
}
