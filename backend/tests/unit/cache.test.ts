import { describe, expect, it } from 'vitest';
import { InMemoryCacheService } from '../../src/services/cache.js';

describe('unit: cache service', () => {
  it('get/set/del round-trips JSON values', async () => {
    const cache = new InMemoryCacheService();
    await cache.set('k', { a: 1 }, 60);
    expect(await cache.get<{ a: number }>('k')).toEqual({ a: 1 });
    await cache.del('k');
    expect(await cache.get('k')).toBeNull();
  });

  it('delByPrefix removes all matching keys', async () => {
    const cache = new InMemoryCacheService();
    await cache.set('feed:page:first:20', [1], 60);
    await cache.set('feed:page:first:50', [2], 60);
    await cache.set('other:key', [3], 60);
    await cache.delByPrefix('feed:page:');
    expect(await cache.get('feed:page:first:20')).toBeNull();
    expect(await cache.get('feed:page:first:50')).toBeNull();
    expect(await cache.get('other:key')).not.toBeNull();
  });

  it('incrWithExpiry counts within a window', async () => {
    const cache = new InMemoryCacheService();
    expect(await cache.incrWithExpiry('rl:u1', 60)).toBe(1);
    expect(await cache.incrWithExpiry('rl:u1', 60)).toBe(2);
    expect(await cache.incrWithExpiry('rl:u1', 60)).toBe(3);
  });
});
