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
    db.seedActivity(user.id, { mediaType: 'book', title: 'Dune', author: 'Herbert' });
    db.seedActivity(user.id, { mediaType: 'music', title: 'Blue', author: 'Joni' });
    const session = db.seedSession(user.id);

    const res = await t.app.inject({
      method: 'GET',
      url: '/api/home',
      headers: { cookie: t.sessionCookie(session.id) },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('ownItems');
    expect(body).toHaveProperty('counts');
    expect(body).toHaveProperty('recommendations');
    expect(Array.isArray(body.ownItems)).toBe(true);
    expect(body.ownItems.length).toBe(2);
    expect(body.counts).toMatchObject({ currentlyOn: 2, wishlisted: 0 });
    expect(body.recommendations).toEqual([]);

    const item = body.ownItems[0];
    expect(item).toMatchObject({ canDelete: true });
    expect(item.author).toMatchObject({ id: user.id, displayName: 'Ada' });
    expect(typeof item.id).toBe('string');
    expect(typeof item.createdAt).toBe('string');
  });
});
