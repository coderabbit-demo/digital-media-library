import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/test-app.js';
import { createFakePrisma, type FakePrisma } from '../helpers/prisma-fake.js';
import { fakeProviders } from '../helpers/fake-provider.js';

/** Contract tests for GET /api/discover/{category} vs contracts/openapi.yaml. */
describe('contract: discover', () => {
  let t: TestApp;
  let db: FakePrisma;

  beforeEach(async () => {
    db = createFakePrisma();
    t = await buildTestApp({ prisma: db.client, providers: fakeProviders() });
  });

  afterEach(async () => {
    await t.app.close();
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/discover/books' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 DiscoverPage with normalized items and stale flag', async () => {
    const user = db.seedProfile();
    const session = db.seedSession(user.id);
    const res = await t.app.inject({
      method: 'GET',
      url: '/api/discover/books?limit=5',
      headers: { cookie: t.sessionCookie(session.id) },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ category: 'book', stale: false });
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBe(5);
    const item = body.items[0];
    expect(item).toMatchObject({ mediaType: 'book' });
    expect(item).toHaveProperty('title');
    expect(item).toHaveProperty('creator');
    expect(item).toHaveProperty('coverUrl');
    expect(item).toHaveProperty('providerId');
    // Internal `provider` field must not leak to the API.
    expect(item).not.toHaveProperty('provider');
  });

  it('rejects an unknown category with 400', async () => {
    const user = db.seedProfile();
    const session = db.seedSession(user.id);
    const res = await t.app.inject({
      method: 'GET',
      url: '/api/discover/films',
      headers: { cookie: t.sessionCookie(session.id) },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects an out-of-range limit with 400', async () => {
    const user = db.seedProfile();
    const session = db.seedSession(user.id);
    const res = await t.app.inject({
      method: 'GET',
      url: '/api/discover/music?limit=999',
      headers: { cookie: t.sessionCookie(session.id) },
    });
    expect(res.statusCode).toBe(400);
  });
});
