import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/test-app.js';
import { createFakePrisma, type FakePrisma } from '../helpers/prisma-fake.js';

describe('contract: ratings & likes', () => {
  let t: TestApp;
  let db: FakePrisma;

  beforeEach(async () => {
    db = createFakePrisma();
    t = await buildTestApp({ prisma: db.client });
  });
  afterEach(async () => {
    await t.app.close();
  });

  const auth = (name = 'Ada') => {
    const u = db.seedProfile({ displayName: name });
    return { u, cookie: t.sessionCookie(db.seedSession(u.id).id) };
  };

  // --- ratings ---

  it('PUT a rating (200), GET lists it, and re-PUT updates the stars', async () => {
    const { cookie } = auth();
    const body = { mediaType: 'book', providerId: 'b1', stars: 4, title: 'Dune', creator: 'Herbert' };
    const res = await t.app.inject({ method: 'PUT', url: '/api/ratings', headers: { cookie }, payload: body });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ mediaType: 'book', providerId: 'b1', stars: 4 });

    await t.app.inject({ method: 'PUT', url: '/api/ratings', headers: { cookie }, payload: { ...body, stars: 5 } });
    const list = await t.app.inject({ method: 'GET', url: '/api/ratings', headers: { cookie } });
    expect(list.json().ratings).toEqual([{ mediaType: 'book', providerId: 'b1', stars: 5 }]);
  });

  it('rejects out-of-range stars and requires auth', async () => {
    const { cookie } = auth();
    expect((await t.app.inject({ method: 'PUT', url: '/api/ratings', headers: { cookie }, payload: { mediaType: 'book', providerId: 'b1', stars: 9, title: 'X' } })).statusCode).toBe(400);
    expect((await t.app.inject({ method: 'GET', url: '/api/ratings' })).statusCode).toBe(401);
  });

  it('DELETE clears a rating', async () => {
    const { cookie } = auth();
    await t.app.inject({ method: 'PUT', url: '/api/ratings', headers: { cookie }, payload: { mediaType: 'book', providerId: 'b1', stars: 3, title: 'X' } });
    const del = await t.app.inject({ method: 'DELETE', url: '/api/ratings?mediaType=book&providerId=b1', headers: { cookie } });
    expect(del.statusCode).toBe(204);
    const list = await t.app.inject({ method: 'GET', url: '/api/ratings', headers: { cookie } });
    expect(list.json().ratings).toEqual([]);
  });

  it('ratings are private per user', async () => {
    const ada = auth('Ada');
    await t.app.inject({ method: 'PUT', url: '/api/ratings', headers: { cookie: ada.cookie }, payload: { mediaType: 'book', providerId: 'b1', stars: 5, title: 'X' } });
    const bob = auth('Bob');
    expect((await t.app.inject({ method: 'GET', url: '/api/ratings', headers: { cookie: bob.cookie } })).json().ratings).toEqual([]);
  });

  // --- likes ---

  it('like/unlike an activity reflects in the feed (count + likedByMe)', async () => {
    const { u, cookie } = auth();
    const activity = db.seedActivity(u.id, { title: 'Dune' });

    expect((await t.app.inject({ method: 'POST', url: `/api/activities/${activity.id}/like`, headers: { cookie } })).statusCode).toBe(204);
    // Idempotent.
    await t.app.inject({ method: 'POST', url: `/api/activities/${activity.id}/like`, headers: { cookie } });

    let feed = await t.app.inject({ method: 'GET', url: '/api/feed', headers: { cookie } });
    let item = feed.json().items.find((i: { id: string }) => i.id === activity.id);
    expect(item).toMatchObject({ likeCount: 1, likedByMe: true });

    expect((await t.app.inject({ method: 'DELETE', url: `/api/activities/${activity.id}/like`, headers: { cookie } })).statusCode).toBe(204);
    feed = await t.app.inject({ method: 'GET', url: '/api/feed', headers: { cookie } });
    item = feed.json().items.find((i: { id: string }) => i.id === activity.id);
    expect(item).toMatchObject({ likeCount: 0, likedByMe: false });
  });

  it('likedByMe is per-viewer; count is shared', async () => {
    const ada = auth('Ada');
    const activity = db.seedActivity(ada.u.id, { title: 'Dune' });
    await t.app.inject({ method: 'POST', url: `/api/activities/${activity.id}/like`, headers: { cookie: ada.cookie } });

    const bob = auth('Bob');
    const feed = await t.app.inject({ method: 'GET', url: '/api/feed', headers: { cookie: bob.cookie } });
    const item = feed.json().items.find((i: { id: string }) => i.id === activity.id);
    expect(item).toMatchObject({ likeCount: 1, likedByMe: false });
  });

  it('liking an unknown activity is 404; like requires auth', async () => {
    const { cookie } = auth();
    expect((await t.app.inject({ method: 'POST', url: '/api/activities/00000000-0000-0000-0000-000000000000/like', headers: { cookie } })).statusCode).toBe(404);
    expect((await t.app.inject({ method: 'POST', url: '/api/activities/x/like' })).statusCode).toBe(401);
  });
});
