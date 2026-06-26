import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Signer } from '@fastify/cookie';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { InMemoryCacheService } from '../../src/services/cache.js';
import { StubOidcService } from '../helpers/oidc-stub.js';
import { startIntegrationDb, resetDb, type IntegrationDb } from '../helpers/integration-db.js';
import { testConfig, TEST_SIGNING_KEY } from '../helpers/test-app.js';
import { SESSION_COOKIE_NAME } from '../../src/plugins/session.js';

/**
 * Integration: post appears at head, validation 400, cross-user delete 403,
 * own delete 204, rate limit 429 on the 11th post/min, and plain-text storage.
 */
describe('integration: activities', () => {
  let dbh: IntegrationDb;
  let app: FastifyInstance;
  const signer = new Signer(TEST_SIGNING_KEY);

  beforeAll(async () => {
    dbh = await startIntegrationDb();
    app = await buildApp({
      config: testConfig({ DATABASE_URL: dbh.databaseUrl }),
      prisma: dbh.prisma,
      cache: new InMemoryCacheService(),
      oidc: new StubOidcService(),
    });
    await app.ready();
  });

  afterEach(async () => {
    await resetDb(dbh.prisma);
  });

  afterAll(async () => {
    await app.close();
    await dbh.stop();
  });

  async function makeUserWithSession(name = 'Reader') {
    const user = await dbh.prisma.userProfile.create({
      data: { googleSub: `g-${Math.random()}`, displayName: name },
    });
    const session = await dbh.prisma.session.create({
      data: { userId: user.id, expiresAt: new Date(Date.now() + 3600_000), lastSeenAt: new Date() },
    });
    return { user, cookie: `${SESSION_COOKIE_NAME}=${signer.sign(session.id)}` };
  }

  it('posted update appears at the top of the feed', async () => {
    const { cookie } = await makeUserWithSession();
    const post = await app.inject({
      method: 'POST',
      url: '/api/activities',
      headers: { cookie },
      payload: { mediaType: 'book', title: 'Fresh Post' },
    });
    expect(post.statusCode).toBe(201);

    const feed = await app.inject({ method: 'GET', url: '/api/feed', headers: { cookie } });
    expect(feed.json().items[0].title).toBe('Fresh Post');
  });

  it('rejects invalid posts with 400', async () => {
    const { cookie } = await makeUserWithSession();
    const res = await app.inject({
      method: 'POST',
      url: '/api/activities',
      headers: { cookie },
      payload: { mediaType: 'book', title: '' },
    });
    expect(res.statusCode).toBe(400);
    expect(await dbh.prisma.activity.count()).toBe(0);
  });

  it('stores user text verbatim (plain text, never interpreted)', async () => {
    const { cookie } = await makeUserWithSession();
    const evil = '<script>alert(1)</script>';
    await app.inject({
      method: 'POST',
      url: '/api/activities',
      headers: { cookie },
      payload: { mediaType: 'book', title: evil, itemAuthor: '<b>x</b>' },
    });
    const stored = await dbh.prisma.activity.findFirst();
    expect(stored?.title).toBe(evil);
    expect(stored?.author).toBe('<b>x</b>');
  });

  it('prevents deleting another user activity (403)', async () => {
    const owner = await makeUserWithSession('Owner');
    const other = await makeUserWithSession('Other');
    const activity = await dbh.prisma.activity.create({
      data: { userId: owner.user.id, mediaType: 'book', title: 'Owned' },
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/activities/${activity.id}`,
      headers: { cookie: other.cookie },
    });
    expect(res.statusCode).toBe(403);
    expect(await dbh.prisma.activity.count()).toBe(1);
  });

  it('allows deleting own activity (204) and removes it from the feed', async () => {
    const { user, cookie } = await makeUserWithSession();
    const activity = await dbh.prisma.activity.create({
      data: { userId: user.id, mediaType: 'book', title: 'Mine' },
    });
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/activities/${activity.id}`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(204);

    const feed = await app.inject({ method: 'GET', url: '/api/feed', headers: { cookie } });
    expect(feed.json().items).toHaveLength(0);
  });

  it('returns 404 for a missing activity', async () => {
    const { cookie } = await makeUserWithSession();
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/activities/00000000-0000-0000-0000-000000000000',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
  });

  it('rate-limits to 10 posts/minute, 429 on the 11th', async () => {
    const { cookie } = await makeUserWithSession();
    for (let i = 0; i < 10; i++) {
      const ok = await app.inject({
        method: 'POST',
        url: '/api/activities',
        headers: { cookie },
        payload: { mediaType: 'book', title: `P${i}` },
      });
      expect(ok.statusCode).toBe(201);
    }
    const res = await app.inject({
      method: 'POST',
      url: '/api/activities',
      headers: { cookie },
      payload: { mediaType: 'book', title: 'eleventh' },
    });
    expect(res.statusCode).toBe(429);
    expect(await dbh.prisma.activity.count()).toBe(10);
  });
});
