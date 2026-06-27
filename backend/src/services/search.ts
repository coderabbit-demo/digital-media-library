import type { MediaType } from '@dml/shared';
import type { CacheService } from './cache.js';
import type { AppConfig } from '../config/index.js';
import type { TrendingItem } from '../providers/content-provider.js';
import type { SearchProvider } from '../providers/search-provider.js';

/**
 * Media search through the provider abstraction with cache-aside (Principle III).
 * Repeat queries for the same (mediaType, normalized query) within the TTL are
 * served from Redis without hitting the provider (feature 004, SC-003).
 *
 * Cache access is best-effort: a Redis hiccup never fails an otherwise-successful
 * provider search. A genuine provider failure propagates so the client can show
 * an error state — distinct from a true zero-result search (an empty list).
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
    const cached = await this.safeGet(cacheKey);
    if (cached) return cached.slice(0, limit);

    // A provider failure propagates (the route surfaces an error to the UI).
    const items = await this.providers[mediaType].search(normalized, Math.max(limit, 20));
    // Best-effort cache write — a Redis failure must not discard a good result.
    await this.safeSet(cacheKey, items);
    return items.slice(0, limit);
  }

  private async safeGet(key: string): Promise<TrendingItem[] | null> {
    try {
      return await this.cache.get<TrendingItem[]>(key);
    } catch {
      return null;
    }
  }

  private async safeSet(key: string, items: TrendingItem[]): Promise<void> {
    try {
      await this.cache.set(key, items, this.config.SEARCH_TTL_SECONDS);
    } catch {
      // Ignore cache write failures; the result is still returned.
    }
  }
}
