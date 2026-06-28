import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/test-app.js';
import { createFakePrisma, type FakePrisma } from '../helpers/prisma-fake.js';
import { InMemoryCacheService } from '../../src/services/cache.js';
import { FakeItemProvider, fakeItemProviders, makeItemDetail } from '../helpers/fake-provider.js';

/** Integration: the item endpoint degrades gracefully and caches detail (feature 007, SC-005). */
describe('integration: item detail resilience & caching', () => {
  let t: TestApp;
  let db: FakePrisma;
  let cache: InMemoryCacheService;

  beforeEach(() => {
    db = createFakePrisma();
    cache = new InMemoryCacheService();
  });
  afterEach(async () => {
    if (t) await t.app.close();
  });

  const auth = () => {
    const user = db.seedProfile();
    return { user, cookie: t.sessionCookie(db.seedSession(user.id).id) };
  };

  it('returns 200 with detailAvailable:false and populated stats when the provider throws', async () => {
    const failing = new FakeItemProvider(makeItemDetail('book', 'b1'));
    failing.fail = true;
    t = await buildTestApp({
      prisma: db.client,
      cache,
      itemProviders: { ...fakeItemProviders(), book: failing },
    });
    const { user, cookie } = auth();
    db.seedLibraryItem(user.id, { mediaType: 'book', providerId: 'b1', shelf: 'current' });

    const res = await t.app.inject({ method: 'GET', url: '/api/items/book/b1', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.detailAvailable).toBe(false);
    expect(body.item).toBeNull();
    expect(body.stats.shelfCounts.current).toBe(1);
  });

  it('falls back to last-known-good detail when the provider fails after a success', async () => {
    const book = new FakeItemProvider(makeItemDetail('book', 'b1'));
    t = await buildTestApp({
      prisma: db.client,
      cache,
      itemProviders: { ...fakeItemProviders(), book },
    });
    const { cookie } = auth();

    // Prime the cache (fresh + last-known-good).
    await t.app.inject({ method: 'GET', url: '/api/items/book/b1', headers: { cookie } });
    // Expire only the fresh window, then break the provider.
    await cache.delByPrefix('item:fresh:');
    book.fail = true;

    const res = await t.app.inject({ method: 'GET', url: '/api/items/book/b1', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.detailAvailable).toBe(true);
    expect(body.item.title).toBe('book b1'); // served from last-known-good
  });

  it('serves the second request detail from cache (one provider call)', async () => {
    const book = new FakeItemProvider(makeItemDetail('book', 'b1'));
    t = await buildTestApp({
      prisma: db.client,
      cache,
      itemProviders: { ...fakeItemProviders(), book },
    });
    const { cookie } = auth();

    const r1 = await t.app.inject({ method: 'GET', url: '/api/items/book/b1', headers: { cookie } });
    const r2 = await t.app.inject({ method: 'GET', url: '/api/items/book/b1', headers: { cookie } });
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(r1.json().item.title).toBe('book b1');
    expect(book.calls).toBe(1); // second served from cache
  });
});
