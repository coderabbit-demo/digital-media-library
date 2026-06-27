import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/test-app.js';
import { createFakePrisma, type FakePrisma } from '../helpers/prisma-fake.js';

/** Contract tests for GET /api/home vs contracts/openapi.yaml. */
describe('contract: home', () => {
  let t: TestApp;
  let db: FakePrisma;

  beforeEach(async () => {
    db = createFakePrisma();
    t = await buildTestApp({ prisma: db.client });
  });

  afterEach(async () => {
    await t.app.close();
  });

  it('returns 401 ErrorDTO when unauthenticated', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/home' });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('message');
  });

  it('returns 200 HomeData with ownItems, counts, and empty recommendations', async () => {
    const user = db.seedProfile({ displayName: 'Ada', avatarUrl: null });
    db.seedLibraryItem(user.id, { mediaType: 'book', title: 'Dune', creator: 'Herbert', shelf: 'current' });
    db.seedLibraryItem(user.id, { mediaType: 'music', title: 'Blue', creator: 'Joni', shelf: 'current' });
    db.seedLibraryItem(user.id, { mediaType: 'book', title: 'Later', shelf: 'want' });
    const session = db.seedSession(user.id);

    const res = await t.app.inject({
      method: 'GET',
      url: '/api/home',
      headers: { cookie: t.sessionCookie(session.id) },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('current');
    expect(body).toHaveProperty('counts');
    expect(body).toHaveProperty('recommendations');
    expect(Array.isArray(body.current)).toBe(true);
    expect(body.current.length).toBe(2);
    // currentlyOn = current shelf size; wishlisted = want shelf size.
    expect(body.counts).toMatchObject({ currentlyOn: 2, wishlisted: 1 });
    expect(body.recommendations).toEqual([]);

    const item = body.current[0];
    expect(item).toMatchObject({ shelf: 'current' });
    expect(typeof item.id).toBe('string');
    expect(typeof item.createdAt).toBe('string');
  });
});
