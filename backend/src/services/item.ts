import type { MediaType } from '@dml/shared';
import type { CacheService } from './cache.js';
import type { AppConfig } from '../config/index.js';
import type { ItemDetail, ItemProvider } from '../providers/item-provider.js';

/** Last-known-good detail is kept far longer than the fresh window (30 days). */
const LKG_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * Item detail through the provider abstraction with cache-aside (Principle III).
 * Detail is stable, so it's cached aggressively. Two keys mirror TrendingService:
 * a short-lived `fresh` entry (`ITEM_TTL_SECONDS`) and a long-lived
 * last-known-good (`lkg`) snapshot. When the fresh entry has expired and the
 * provider then fails, the lkg snapshot is served (true stale fallback); only
 * with no snapshot at all does the failure propagate (route degrades to
 * stats-only). Cache access is best-effort — a Redis hiccup never fails an
 * otherwise-good lookup.
 */
export class ItemService {
  constructor(
    private readonly cache: CacheService,
    private readonly providers: Record<MediaType, ItemProvider>,
    private readonly config: AppConfig,
  ) {}

  async getItem(mediaType: MediaType, providerId: string): Promise<ItemDetail | null> {
    const freshKey = `item:fresh:${mediaType}:${providerId}`;
    const lkgKey = `item:lkg:${mediaType}:${providerId}`;

    const fresh = await this.safeGet(freshKey);
    if (fresh) return fresh;

    let detail: ItemDetail | null;
    try {
      detail = await this.providers[mediaType].getItem(providerId);
    } catch (err) {
      // Provider failed: serve the last-known-good snapshot if we have one.
      const stale = await this.safeGet(lkgKey);
      if (stale) return stale;
      throw err;
    }

    // Only cache hits; a genuine miss (null) stays uncached so a later fix is seen.
    if (detail) {
      await this.safeSet(freshKey, detail, this.config.ITEM_TTL_SECONDS);
      await this.safeSet(lkgKey, detail, LKG_TTL_SECONDS);
    }
    return detail;
  }

  private async safeGet(key: string): Promise<ItemDetail | null> {
    try {
      return await this.cache.get<ItemDetail>(key);
    } catch {
      return null;
    }
  }

  private async safeSet(key: string, detail: ItemDetail, ttlSeconds: number): Promise<void> {
    try {
      await this.cache.set(key, detail, ttlSeconds);
    } catch {
      // Ignore cache write failures; the result is still returned.
    }
  }
}
