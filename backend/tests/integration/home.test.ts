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
 * Integration: GET /api/home aggregates own items + counts from real PostgreSQL,
 * scopes own items to the requesting user, and requires authentication.
 */
describe('integration: home', () => {
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

  async function makeUser(name: string) {
    const user = await dbh.prisma.userProfile.create({
      data: { googleSub: `g-${name}-${Math.random()}`, displayName: name },
    });
    const session = await dbh.prisma.session.create({
      data: { userId: user.id, expiresAt: new Date(Date.now() + 3600_000), lastSeenAt: new Date() },
    });
    return { user, cookie: `${SESSION_COOKIE_NAME}=${signer.sign(session.id)}` };
  }

  it('requires authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/home' });
    expect(res.statusCode).toBe(401);
  });

  it('returns the user\'s own items and counts, with empty recommendations and wishlisted=0', async () => {
    const a = await makeUser('Ada');
    for (const title of ['One', 'Two', 'Three']) {
      await dbh.prisma.activity.create({
        data: { userId: a.user.id, mediaType: 'book', title },
      });
    }

    const res = await app.inject({ method: 'GET', url: '/api/home', headers: { cookie: a.cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ownItems.length).toBe(3);
    expect(body.ownItems.every((i: { canDelete: boolean }) => i.canDelete === true)).toBe(true);
    expect(body.counts).toEqual({ currentlyOn: 3, wishlisted: 0 });
    expect(body.recommendations).toEqual([]);
  });

  it('scopes own items to the requesting user only', async () => {
    const a = await makeUser('Ada');
    const b = await makeUser('Bob');
    await dbh.prisma.activity.create({ data: { userId: a.user.id, mediaType: 'book', title: 'A-book' } });
    await dbh.prisma.activity.create({ data: { userId: b.user.id, mediaType: 'music', title: 'B-song' } });

    const res = await app.inject({ method: 'GET', url: '/api/home', headers: { cookie: b.cookie } });
    const body = res.json();
    expect(body.ownItems.length).toBe(1);
    expect(body.ownItems[0].title).toBe('B-song');
    expect(body.counts.currentlyOn).toBe(1);
  });

  it('returns empty own items for a user with no activity', async () => {
    const a = await makeUser('Newbie');
    const res = await app.inject({ method: 'GET', url: '/api/home', headers: { cookie: a.cookie } });
    const body = res.json();
    expect(body.ownItems).toEqual([]);
    expect(body.counts.currentlyOn).toBe(0);
  });
});
