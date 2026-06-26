import { Redis } from 'ioredis';

/**
 * Cache abstraction (Principle III). Application code depends on this interface,
 * not on ioredis directly, so the backing store can change without ripple. In
 * this feature it fronts the global feed's first page; later features front
 * external-provider responses behind the same boundary.
 */
export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Delete every key under a logical prefix (e.g. all feed pages). */
  delByPrefix(prefix: string): Promise<void>;
  /**
   * Increment a counter and ensure it expires after `windowSeconds`. Returns
   * the post-increment value. Used for per-user rate-limit windows (FR-019).
   */
  incrWithExpiry(key: string, windowSeconds: number): Promise<number>;
  /** Disconnect the underlying client (for graceful shutdown / tests). */
  close(): Promise<void>;
}

/** Redis-backed implementation using ioredis. Values are JSON-serialized. */
export class RedisCacheService implements CacheService {
  constructor(private readonly redis: Redis) {}

  static fromUrl(url: string): RedisCacheService {
    // lazyConnect avoids opening a socket until first use; helps cold starts.
    return new RedisCacheService(new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 }));
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Corrupt/legacy value: treat as a miss and let the caller rebuild.
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async delByPrefix(prefix: string): Promise<void> {
    const pattern = `${prefix}*`;
    const pipeline = this.redis.pipeline();
    let cursor = '0';
    // SCAN avoids blocking Redis the way KEYS would on large keyspaces.
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      for (const key of keys) pipeline.del(key);
    } while (cursor !== '0');
    await pipeline.exec();
  }

  async incrWithExpiry(key: string, windowSeconds: number): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      // First write in this window: set the expiry so the window resets.
      await this.redis.expire(key, windowSeconds);
    }
    return count;
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

/**
 * In-memory CacheService for unit tests and environments without Redis. Not for
 * production use (per-instance only; violates statelessness).
 */
export class InMemoryCacheService implements CacheService {
  private store = new Map<string, { value: string; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return JSON.parse(entry.value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value: JSON.stringify(value), expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async delByPrefix(prefix: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  async incrWithExpiry(key: string, windowSeconds: number): Promise<number> {
    const existing = this.store.get(key);
    const now = Date.now();
    if (!existing || existing.expiresAt <= now) {
      this.store.set(key, { value: '1', expiresAt: now + windowSeconds * 1000 });
      return 1;
    }
    const next = Number(existing.value) + 1;
    existing.value = String(next);
    return next;
  }

  async close(): Promise<void> {
    this.store.clear();
  }
}
