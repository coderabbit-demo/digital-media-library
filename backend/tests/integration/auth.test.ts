import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { InMemoryCacheService } from '../../src/services/cache.js';
import { StubOidcService } from '../helpers/oidc-stub.js';
import { startIntegrationDb, resetDb, type IntegrationDb } from '../helpers/integration-db.js';
import { testConfig } from '../helpers/test-app.js';

/**
 * Integration: real PostgreSQL via Testcontainers; Google OIDC stubbed.
 * Covers first sign-in creating a profile, repeat sign-in reusing it (no
 * duplicate google_sub), and declined consent.
 */
describe('integration: auth', () => {
  let dbh: IntegrationDb;
  let app: FastifyInstance;
  let oidc: StubOidcService;

  beforeAll(async () => {
    dbh = await startIntegrationDb();
    oidc = new StubOidcService();
    app = await buildApp({
      config: testConfig({ DATABASE_URL: dbh.databaseUrl }),
      prisma: dbh.prisma,
      cache: new InMemoryCacheService(),
      oidc,
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

  async function signIn(): Promise<string> {
    const login = await app.inject({ method: 'GET', url: '/api/auth/google/login' });
    const tx = String(login.headers['set-cookie']).split(';')[0];
    const cb = await app.inject({
      method: 'GET',
      url: '/api/auth/google/callback?code=abc&state=test-state',
      headers: { cookie: tx },
    });
    expect(cb.statusCode).toBe(302);
    return cb.statusCode === 302 ? String(cb.headers['set-cookie']) : '';
  }

  it('first sign-in creates exactly one profile', async () => {
    oidc.setClaims({ sub: 'g-1', email: 'a@x.com', name: 'Ada', picture: null });
    await signIn();

    const profiles = await dbh.prisma.userProfile.findMany();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]!.googleSub).toBe('g-1');
    expect(profiles[0]!.displayName).toBe('Ada');
  });

  it('repeat sign-in reuses the profile (no duplicate google_sub)', async () => {
    oidc.setClaims({ sub: 'g-2', email: 'b@x.com', name: 'Grace', picture: null });
    await signIn();
    // Second sign-in with the same sub but refreshed name.
    oidc.setClaims({ sub: 'g-2', email: 'b@x.com', name: 'Grace Hopper', picture: null });
    await signIn();

    const profiles = await dbh.prisma.userProfile.findMany({ where: { googleSub: 'g-2' } });
    expect(profiles).toHaveLength(1);
    expect(profiles[0]!.displayName).toBe('Grace Hopper');
  });

  it('declined consent creates no profile and no session', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/google/callback?error=access_denied',
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('auth_error=access_denied');
    expect(await dbh.prisma.userProfile.count()).toBe(0);
    expect(await dbh.prisma.session.count()).toBe(0);
  });

  it('uses a default display name when Google omits the name', async () => {
    oidc.setClaims({ sub: 'g-3', email: null, name: null, picture: null });
    await signIn();
    const p = await dbh.prisma.userProfile.findUnique({ where: { googleSub: 'g-3' } });
    expect(p?.displayName).toBeTruthy();
  });
});
