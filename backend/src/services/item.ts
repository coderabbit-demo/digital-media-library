import type { MediaType } from '@dml/shared';
import type { CacheService } from './cache.js';
import type { AppConfig } from '../config/index.js';
import type { ItemDetail, ItemProvider } from '../providers/item-provider.js';

/**
 * Item detail through the provider abstraction with cache-aside (Principle III).
 * Detail is stable, so it's cached aggressively (`ITEM_TTL_SECONDS`). Cache
 * access is best-effort; a Redis hiccup never fails an otherwise-good lookup.
 * A provider failure after a prior success falls back to the last-cached detail;
 * with no cached value, the failure propagates so the route can degrade to a
 * stats-only response.
 */
export class ItemService {
  constructor(
    private readonly cache: CacheService,
    private readonly providers: Record<MediaType, ItemProvider>,
    private readonly config: AppConfig,
  ) {}

  async getItem(mediaType: MediaType, providerId: string): Promise<ItemDetail | null> {
    const cacheKey = `item:${mediaType}:${providerId}`;
    const cached = await this.safeGet(cacheKey);
    if (cached) return cached;

    let detail: ItemDetail | null;
    try {
      detail = await this.providers[mediaType].getItem(providerId);
    } catch (err) {
      // Provider failed: serve last-known-good if we have it, else surface.
      const stale = await this.safeGet(cacheKey);
      if (stale) return stale;
      throw err;
    }

    // Only cache hits; a genuine miss (null) stays uncached so a later fix is seen.
    if (detail) await this.safeSet(cacheKey, detail);
    return detail;
  }

  private async safeGet(key: string): Promise<ItemDetail | null> {
    try {
      return await this.cache.get<ItemDetail>(key);
    } catch {
      return null;
    }
  }

  private async safeSet(key: string, detail: ItemDetail): Promise<void> {
    try {
      await this.cache.set(key, detail, this.config.ITEM_TTL_SECONDS);
    } catch {
      // Ignore cache write failures; the result is still returned.
    }
  }
}
