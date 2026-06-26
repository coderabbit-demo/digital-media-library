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
 * Integration: feed ordering, keyset stability under insert, empty state, and
 * auth-required, against real PostgreSQL.
 */
describe('integration: feed', () => {
  let dbh: IntegrationDb;
  let app: FastifyInstance;
  let cache: InMemoryCacheService;
  const signer = new Signer(TEST_SIGNING_KEY);

  beforeAll(async () => {
    dbh = await startIntegrationDb();
    cache = new InMemoryCacheService();
    app = await buildApp({
      config: testConfig({ DATABASE_URL: dbh.databaseUrl }),
      prisma: dbh.prisma,
      cache,
      oidc: new StubOidcService(),
    });
    await app.ready();
  });

  afterEach(async () => {
    await resetDb(dbh.prisma);
    // Tests seed via direct DB inserts (bypassing cache invalidation), so the
    // shared first-page cache must be cleared between tests to avoid stale reads.
    await cache.delByPrefix('');
  });

  afterAll(async () => {
    await app.close();
    await dbh.stop();
  });

  async function makeUserWithSession() {
    const user = await dbh.prisma.userProfile.create({
      data: { googleSub: `g-${Math.random()}`, displayName: 'Reader' },
    });
    const session = await dbh.prisma.session.create({
      data: { userId: user.id, expiresAt: new Date(Date.now() + 3600_000), lastSeenAt: new Date() },
    });
    return { user, cookie: `${SESSION_COOKIE_NAME}=${signer.sign(session.id)}` };
  }

  it('requires authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/feed' });
    expect(res.statusCode).toBe(401);
  });

  it('returns an empty page when no activities exist', async () => {
    const { cookie } = await makeUserWithSession();
    const res = await app.inject({ method: 'GET', url: '/api/feed', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [], nextCursor: null });
  });

  it('orders activities most-recent-first', async () => {
    const { user, cookie } = await makeUserWithSession();
    const base = Date.now();
    for (let i = 0; i < 3; i++) {
      await dbh.prisma.activity.create({
        data: {
          userId: user.id,
          mediaType: 'book',
          title: `Title ${i}`,
          createdAt: new Date(base + i * 1000),
        },
      });
    }
    const res = await app.inject({ method: 'GET', url: '/api/feed', headers: { cookie } });
    const titles = res.json().items.map((a: { title: string }) => a.title);
    expect(titles).toEqual(['Title 2', 'Title 1', 'Title 0']);
  });

  it('keyset pagination is stable when new items are inserted mid-paging', async () => {
    const { user, cookie } = await makeUserWithSession();
    const base = Date.now();
    for (let i = 0; i < 5; i++) {
      await dbh.prisma.activity.create({
        data: {
          userId: user.id,
          mediaType: 'book',
          title: `Old ${i}`,
          createdAt: new Date(base + i * 1000),
        },
      });
    }

    // Page 1 (limit 2): newest two.
    const p1 = await app.inject({ method: 'GET', url: '/api/feed?limit=2', headers: { cookie } });
    const page1 = p1.json();
    expect(page1.items.map((a: any) => a.title)).toEqual(['Old 4', 'Old 3']);
    expect(page1.nextCursor).toBeTruthy();

    // A new item arrives at the head before page 2.
    await dbh.prisma.activity.create({
      data: { userId: user.id, mediaType: 'book', title: 'BRAND NEW', createdAt: new Date(base + 10_000) },
    });

    // Page 2 uses the cursor; must continue from Old 2 without dupes/skips.
    const p2 = await app.inject({
      method: 'GET',
      url: `/api/feed?limit=2&cursor=${encodeURIComponent(page1.nextCursor)}`,
      headers: { cookie },
    });
    const page2Titles = p2.json().items.map((a: any) => a.title);
    expect(page2Titles).toEqual(['Old 2', 'Old 1']);
    expect(page2Titles).not.toContain('BRAND NEW');
  });

  it('sets canDelete per viewer', async () => {
    const a = await makeUserWithSession();
    const b = await makeUserWithSession();
    await dbh.prisma.activity.create({
      data: { userId: a.user.id, mediaType: 'music', title: 'Mine' },
    });

    const asA = await app.inject({ method: 'GET', url: '/api/feed', headers: { cookie: a.cookie } });
    expect(asA.json().items[0].canDelete).toBe(true);

    const asB = await app.inject({ method: 'GET', url: '/api/feed', headers: { cookie: b.cookie } });
    expect(asB.json().items[0].canDelete).toBe(false);
  });
});
