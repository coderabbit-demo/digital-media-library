import type { MediaType } from '@dml/shared';
import type { CacheService } from './cache.js';
import type { AppConfig } from '../config/index.js';
import type { ContentProvider, TrendingItem } from '../providers/content-provider.js';

/** Retention for the last-known-good snapshot used on provider failure (7 days). */
const LAST_GOOD_TTL_SECONDS = 60 * 60 * 24 * 7;
/** Short window after a failure during which we don't re-hit a failing provider. */
const COOLDOWN_SECONDS = 60;

export interface DiscoverResult {
  items: TrendingItem[];
  /** True when served from the last-known-good snapshot (results may be out of date). */
  stale: boolean;
  /** True when served from the fresh cache without contacting the provider (for logs). */
  cacheHit: boolean;
}

/**
 * Serves trending items per media type through the provider abstraction with
 * cache-aside + stale-on-failure (constitution Principle III):
 *  1. fresh cache (within TTL) → serve immediately (cacheHit)
 *  2. otherwise fetch via the provider; on success refresh fresh + last-known-good
 *  3. on failure (or during cooldown) → serve last-known-good (stale) if present
 *  4. otherwise → empty (the client shows an unavailable state)
 */
export class TrendingService {
  /**
   * Per-category in-flight refresh promises (single-flight). Coalesces concurrent
   * cold-cache requests on the same instance so only one provider fetch runs,
   * protecting the refresh cadence/quota during spikes. (Cross-instance
   * coordination via a distributed lock is unnecessary at the current scale.)
   */
  private readonly inFlight = new Map<MediaType, Promise<TrendingItem[]>>();

  constructor(
    private readonly cache: CacheService,
    private readonly providers: Record<MediaType, ContentProvider>,
    private readonly config: AppConfig,
  ) {}

  async getDiscover(mediaType: MediaType, limit: number): Promise<DiscoverResult> {
    const freshKey = `discover:fresh:${mediaType}`;
    const lastGoodKey = `discover:lastgood:${mediaType}`;
    const cooldownKey = `discover:cooldown:${mediaType}`;

    const fresh = await this.cache.get<TrendingItem[]>(freshKey);
    if (fresh) {
      return { items: fresh.slice(0, limit), stale: false, cacheHit: true };
    }

    const cooling = await this.cache.get<string>(cooldownKey);
    if (!cooling) {
      try {
        // Single-flight: concurrent callers share one fetch + cache write.
        let refresh = this.inFlight.get(mediaType);
        if (!refresh) {
          refresh = (async () => {
            // Fetch a small batch so different limits share one cached result.
            const items = await this.providers[mediaType].getTrending(Math.max(limit, 20));
            await this.cache.set(freshKey, items, this.config.DISCOVER_TTL_SECONDS);
            await this.cache.set(lastGoodKey, items, LAST_GOOD_TTL_SECONDS);
            return items;
          })().finally(() => this.inFlight.delete(mediaType));
          this.inFlight.set(mediaType, refresh);
        }
        const items = await refresh;
        return { items: items.slice(0, limit), stale: false, cacheHit: false };
      } catch {
        // Back off briefly so we don't hammer a failing provider (and burn quota).
        await this.cache.set(cooldownKey, '1', COOLDOWN_SECONDS);
      }
    }

    const lastGood = await this.cache.get<TrendingItem[]>(lastGoodKey);
    if (lastGood) {
      return { items: lastGood.slice(0, limit), stale: true, cacheHit: false };
    }

    return { items: [], stale: false, cacheHit: false };
  }
}
