import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/test-app.js';
import { createFakePrisma, type FakePrisma } from '../helpers/prisma-fake.js';
import type { MediaType } from '@dml/shared';
import type { SearchProvider } from '../../src/providers/search-provider.js';
import type { TrendingItem } from '../../src/providers/content-provider.js';

/** A fake search provider returning a fixed item; counts calls for cache assertions. */
class FakeSearch implements SearchProvider {
  readonly name = 'fake-search';
  calls = 0;
  constructor(private readonly item: TrendingItem) {}
  async search(): Promise<TrendingItem[]> {
    this.calls++;
    return [this.item];
  }
}

function searchProviders(item: TrendingItem) {
  const p = new FakeSearch(item);
  return {
    providers: { book: p, music: p, audiobook: p, podcast: p } as Record<MediaType, SearchProvider>,
    p,
  };
}

const bookItem: TrendingItem = {
  mediaType: 'book',
  title: 'Dune',
  creator: 'Frank Herbert',
  coverUrl: 'http://img/d.jpg',
  providerId: 'b1',
  provider: 'fake-search',
  genre: 'Fiction',
};

describe('contract: search & recommendations', () => {
  let t: TestApp;
  let db: FakePrisma;
  let fake: FakeSearch;

  beforeEach(async () => {
    db = createFakePrisma();
    const sp = searchProviders(bookItem);
    fake = sp.p;
    t = await buildTestApp({ prisma: db.client, searchProviders: sp.providers });
  });

  afterEach(async () => {
    await t.app.close();
  });

  // --- search ---

  it('GET /search returns 401 unauthenticated', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/search?category=books&q=dune' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /search returns 400 without q', async () => {
    const user = db.seedProfile();
    const cookie = t.sessionCookie(db.seedSession(user.id).id);
    const res = await t.app.inject({ method: 'GET', url: '/api/search?category=books', headers: { cookie } });
    expect(res.statusCode).toBe(400);
  });

  it('GET /search returns 400 for an unknown category', async () => {
    const user = db.seedProfile();
    const cookie = t.sessionCookie(db.seedSession(user.id).id);
    const res = await t.app.inject({ method: 'GET', url: '/api/search?category=movies&q=x', headers: { cookie } });
    expect(res.statusCode).toBe(400);
  });

  it('GET /search returns results and serves repeats from cache', async () => {
    const user = db.seedProfile();
    const cookie = t.sessionCookie(db.seedSession(user.id).id);
    const r1 = await t.app.inject({ method: 'GET', url: '/api/search?category=books&q=dune', headers: { cookie } });
    expect(r1.statusCode).toBe(200);
    const body = r1.json();
    expect(body).toMatchObject({ category: 'book', query: 'dune' });
    expect(body.items[0]).toMatchObject({ title: 'Dune', creator: 'Frank Herbert', providerId: 'b1', genre: 'Fiction' });

    const r2 = await t.app.inject({ method: 'GET', url: '/api/search?category=books&q=DUNE', headers: { cookie } });
    expect(r2.statusCode).toBe(200);
    // Normalized cache key → one provider call total (SC-003).
    expect(fake.calls).toBe(1);
  });

  // --- recommendations ---

  it('POST /recommendations returns 401 unauthenticated', async () => {
    const res = await t.app.inject({ method: 'POST', url: '/api/recommendations', payload: { mediaType: 'book', title: 'X', providerId: 'b1' } });
    expect(res.statusCode).toBe(401);
  });

  it('POST /recommendations creates (201) and appears in /home; idempotent', async () => {
    const user = db.seedProfile({ displayName: 'Ada' });
    const cookie = t.sessionCookie(db.seedSession(user.id).id);
    const payload = { mediaType: 'book', title: 'Dune', creator: 'Frank Herbert', coverUrl: 'http://img/d.jpg', providerId: 'b1' };

    const res = await t.app.inject({ method: 'POST', url: '/api/recommendations', headers: { cookie }, payload });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ mediaType: 'book', title: 'Dune', itemAuthor: 'Frank Herbert', providerId: 'b1', canRemove: true });

    // Idempotent re-recommend.
    await t.app.inject({ method: 'POST', url: '/api/recommendations', headers: { cookie }, payload });

    const home = await t.app.inject({ method: 'GET', url: '/api/home', headers: { cookie } });
    const recs = home.json().recommendations;
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({ title: 'Dune', canRemove: true });
    expect(recs[0].recommender.displayName).toBe('Ada');
  });

  it('POST /recommendations returns 400 for invalid body', async () => {
    const user = db.seedProfile();
    const cookie = t.sessionCookie(db.seedSession(user.id).id);
    const res = await t.app.inject({ method: 'POST', url: '/api/recommendations', headers: { cookie }, payload: { mediaType: 'book', title: '' } });
    expect(res.statusCode).toBe(400);
  });

  it('DELETE /recommendations/:id removes the user\'s recommendation', async () => {
    const user = db.seedProfile();
    const cookie = t.sessionCookie(db.seedSession(user.id).id);
    const created = await t.app.inject({ method: 'POST', url: '/api/recommendations', headers: { cookie }, payload: { mediaType: 'book', title: 'Dune', providerId: 'b1' } });
    const id = created.json().id;

    const del = await t.app.inject({ method: 'DELETE', url: `/api/recommendations/${id}`, headers: { cookie } });
    expect(del.statusCode).toBe(204);

    const home = await t.app.inject({ method: 'GET', url: '/api/home', headers: { cookie } });
    expect(home.json().recommendations).toHaveLength(0);
  });
});
