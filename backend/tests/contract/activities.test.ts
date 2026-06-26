import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/test-app.js';
import { createFakePrisma, type FakePrisma } from '../helpers/prisma-fake.js';

/** Contract tests for POST/DELETE /api/activities vs contracts/openapi.yaml. */
describe('contract: activities', () => {
  let t: TestApp;
  let db: FakePrisma;

  beforeEach(async () => {
    db = createFakePrisma();
    t = await buildTestApp({ prisma: db.client });
  });

  afterEach(async () => {
    await t.app.close();
  });

  it('POST returns 401 when unauthenticated', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/activities',
      payload: { mediaType: 'book', title: 'X' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toHaveProperty('error');
  });

  it('POST returns 201 with the created Activity', async () => {
    const user = db.seedProfile({ displayName: 'Grace' });
    const session = db.seedSession(user.id);

    const res = await t.app.inject({
      method: 'POST',
      url: '/api/activities',
      headers: { cookie: t.sessionCookie(session.id) },
      payload: { mediaType: 'music', title: 'Kind of Blue', itemAuthor: 'Miles Davis' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({
      mediaType: 'music',
      title: 'Kind of Blue',
      itemAuthor: 'Miles Davis',
      canDelete: true,
    });
    expect(body.author).toMatchObject({ id: user.id, displayName: 'Grace' });
    expect(typeof body.id).toBe('string');
    expect(typeof body.createdAt).toBe('string');
  });

  it('POST returns 400 ErrorDTO for missing title', async () => {
    const user = db.seedProfile();
    const session = db.seedSession(user.id);
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/activities',
      headers: { cookie: t.sessionCookie(session.id) },
      payload: { mediaType: 'book', title: '   ' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty('error');
  });

  it('POST returns 400 for invalid mediaType', async () => {
    const user = db.seedProfile();
    const session = db.seedSession(user.id);
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/activities',
      headers: { cookie: t.sessionCookie(session.id) },
      payload: { mediaType: 'movie', title: 'Inception' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('DELETE own activity returns 204', async () => {
    const user = db.seedProfile();
    const activity = db.seedActivity(user.id);
    const session = db.seedSession(user.id);

    const res = await t.app.inject({
      method: 'DELETE',
      url: `/api/activities/${activity.id}`,
      headers: { cookie: t.sessionCookie(session.id) },
    });
    expect(res.statusCode).toBe(204);
  });

  it('DELETE another user activity returns 403 ErrorDTO', async () => {
    const owner = db.seedProfile();
    const other = db.seedProfile();
    const activity = db.seedActivity(owner.id);
    const session = db.seedSession(other.id);

    const res = await t.app.inject({
      method: 'DELETE',
      url: `/api/activities/${activity.id}`,
      headers: { cookie: t.sessionCookie(session.id) },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toHaveProperty('error');
  });

  it('DELETE missing activity returns 404 ErrorDTO', async () => {
    const user = db.seedProfile();
    const session = db.seedSession(user.id);
    const res = await t.app.inject({
      method: 'DELETE',
      url: `/api/activities/00000000-0000-0000-0000-000000000000`,
      headers: { cookie: t.sessionCookie(session.id) },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST returns 429 after exceeding the per-minute limit', async () => {
    const user = db.seedProfile();
    const session = db.seedSession(user.id);
    const cookie = t.sessionCookie(session.id);

    for (let i = 0; i < 10; i++) {
      const ok = await t.app.inject({
        method: 'POST',
        url: '/api/activities',
        headers: { cookie },
        payload: { mediaType: 'book', title: `Post ${i}` },
      });
      expect(ok.statusCode).toBe(201);
    }

    const limited = await t.app.inject({
      method: 'POST',
      url: '/api/activities',
      headers: { cookie },
      payload: { mediaType: 'book', title: 'one too many' },
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toHaveProperty('error');
    expect(limited.headers).toHaveProperty('retry-after');
  });
});
