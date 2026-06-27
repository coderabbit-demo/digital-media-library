import { describe, expect, it } from 'vitest';
import { TrendingService } from '../../src/services/discover.js';
import { InMemoryCacheService } from '../../src/services/cache.js';
import { FakeProvider, makeItems } from '../helpers/fake-provider.js';
import { testConfig } from '../helpers/test-app.js';

function build(book: FakeProvider, cache = new InMemoryCacheService()) {
  const providers = {
    book,
    music: new FakeProvider(makeItems('music', 5)),
    audiobook: new FakeProvider(makeItems('audiobook', 5)),
  };
  return new TrendingService(cache, providers, testConfig());
}

describe('TrendingService', () => {
  it('fetches once then serves from the fresh cache', async () => {
    const book = new FakeProvider(makeItems('book', 25));
    const svc = build(book);
    const a = await svc.getDiscover('book', 5);
    const b = await svc.getDiscover('book', 5);
    expect(a.stale).toBe(false);
    expect(a.cacheHit).toBe(false);
    expect(b.cacheHit).toBe(true);
    expect(book.calls).toBe(1);
    expect(a.items.length).toBe(5);
  });

  it('serves last-known-good (stale) when the provider fails after a success', async () => {
    const book = new FakeProvider(makeItems('book', 25));
    const cache = new InMemoryCacheService();
    const svc = build(book, cache);
    await svc.getDiscover('book', 5); // seeds fresh + last-good
    await cache.delByPrefix('discover:fresh:');
    book.fail = true;
    const res = await svc.getDiscover('book', 5);
    expect(res.stale).toBe(true);
    expect(res.items.length).toBe(5);
  });

  it('returns empty on cold failure (no cache, provider down)', async () => {
    const book = new FakeProvider(makeItems('book', 25));
    book.fail = true;
    const res = await build(book).getDiscover('book', 5);
    expect(res.items).toEqual([]);
    expect(res.stale).toBe(false);
  });

  it('does not re-hit a failing provider during the cooldown window', async () => {
    const book = new FakeProvider(makeItems('book', 25));
    book.fail = true;
    const svc = build(book);
    await svc.getDiscover('book', 5); // fails → sets cooldown
    await svc.getDiscover('book', 5); // within cooldown → no new provider call
    expect(book.calls).toBe(1);
  });
});
