import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/test-app.js';
import { createFakePrisma, type FakePrisma } from '../helpers/prisma-fake.js';

/** Contract tests for GET /api/feed vs contracts/openapi.yaml. */
describe('contract: feed', () => {
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
    const res = await t.app.inject({ method: 'GET', url: '/api/feed' });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('message');
  });

  it('returns 200 FeedPage with the documented Activity shape', async () => {
    const author = db.seedProfile({ displayName: 'Ada', avatarUrl: null });
    db.seedActivity(author.id, { mediaType: 'book', title: 'Dune', author: 'Herbert' });
    const session = db.seedSession(author.id);

    const res = await t.app.inject({
      method: 'GET',
      url: '/api/feed',
      headers: { cookie: t.sessionCookie(session.id) },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('nextCursor');
    expect(Array.isArray(body.items)).toBe(true);

    const item = body.items[0];
    expect(item).toMatchObject({
      mediaType: 'book',
      title: 'Dune',
      itemAuthor: 'Herbert',
      canDelete: true,
    });
    expect(item.author).toMatchObject({ id: author.id, displayName: 'Ada' });
    expect(item.author).toHaveProperty('avatarUrl');
    expect(typeof item.id).toBe('string');
    expect(typeof item.createdAt).toBe('string');
  });

  it('rejects an out-of-range limit with 400', async () => {
    const author = db.seedProfile();
    const session = db.seedSession(author.id);
    const res = await t.app.inject({
      method: 'GET',
      url: '/api/feed?limit=999',
      headers: { cookie: t.sessionCookie(session.id) },
    });
    expect(res.statusCode).toBe(400);
  });
});
