import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/test-app.js';
import { createFakePrisma, type FakePrisma } from '../helpers/prisma-fake.js';
import { InMemoryCacheService } from '../../src/services/cache.js';
import { FakeProvider, makeItems } from '../helpers/fake-provider.js';

/**
 * Full-stack Discover behavior through the route: cache hit, stale fallback, and
 * cold-failure empty state. Uses the in-memory cache + a controllable fake
 * provider (auth via the fake prisma); no external calls and no DB needed.
 */
describe('integration: discover caching & resilience', () => {
  let t: TestApp;
  let db: FakePrisma;
  let cache: InMemoryCacheService;
  let books: FakeProvider;
  let cookie: string;

  beforeEach(async () => {
    db = createFakePrisma();
    cache = new InMemoryCacheService();
    books = new FakeProvider(makeItems('book', 25));
    t = await buildTestApp({
      prisma: db.client,
      cache,
      providers: {
        book: books,
        music: new FakeProvider(makeItems('music', 25)),
        audiobook: new FakeProvider(makeItems('audiobook', 25)),
      },
    });
    const user = db.seedProfile();
    cookie = t.sessionCookie(db.seedSession(user.id).id);
  });

  afterEach(async () => {
    await t.app.close();
  });

  const get = () => t.app.inject({ method: 'GET', url: '/api/discover/books', headers: { cookie } });

  it('serves the second request from cache (no extra provider call)', async () => {
    const r1 = await get();
    const r2 = await get();
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(r1.json().stale).toBe(false);
    expect(r2.json().stale).toBe(false);
    // Provider was hit once; the second response came from the fresh cache.
    expect(books.calls).toBe(1);
  });

  it('falls back to last-known-good (stale) when the provider fails after a success', async () => {
    await get(); // seeds fresh + last-known-good
    await cache.delByPrefix('discover:fresh:'); // expire only the fresh entry
    books.fail = true;

    const res = await get();
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.stale).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
  });

  it('returns an empty list on cold failure (no cache, provider down)', async () => {
    books.fail = true;
    const res = await get();
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toEqual([]);
  });
});
