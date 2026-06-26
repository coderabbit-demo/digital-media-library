import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/test-app.js';
import { createFakePrisma, type FakePrisma } from '../helpers/prisma-fake.js';

/**
 * Contract tests for the auth endpoints vs contracts/openapi.yaml.
 * OIDC and the DB are stubbed; we assert status codes and cookie/redirect
 * behavior, not Google interaction.
 */
describe('contract: auth', () => {
  let t: TestApp;
  let db: FakePrisma;

  beforeEach(async () => {
    db = createFakePrisma();
    t = await buildTestApp({ prisma: db.client });
  });

  afterEach(async () => {
    await t.app.close();
  });

  it('GET /api/auth/google/login redirects (302) to Google and sets the tx cookie', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/auth/google/login' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('accounts.google.com');
    const setCookie = String(res.headers['set-cookie']);
    expect(setCookie).toContain('dml_oidc_tx=');
    expect(setCookie).toMatch(/HttpOnly/i);
  });

  it('GET /api/auth/google/callback success: upserts profile, sets session cookie, 302 to app', async () => {
    // Begin login to capture the signed tx cookie.
    const login = await t.app.inject({ method: 'GET', url: '/api/auth/google/login' });
    const txCookie = extractCookie(login, 'dml_oidc_tx');

    const res = await t.app.inject({
      method: 'GET',
      url: '/api/auth/google/callback?code=abc&state=test-state',
      headers: { cookie: txCookie },
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('http://localhost:5173/');
    const setCookie = String(res.headers['set-cookie']);
    expect(setCookie).toContain('dml_session=');
  });

  it('GET /api/auth/google/callback with ?error= redirects to /signin with an error indicator', async () => {
    const res = await t.app.inject({
      method: 'GET',
      url: '/api/auth/google/callback?error=access_denied',
    });
    expect(res.statusCode).toBe(302);
    // Declined consent → redirect to the SPA sign-in page with ?error= (FR-006).
    expect(res.headers.location).toContain('/signin?error=access_denied');
    expect(String(res.headers['set-cookie'] ?? '')).not.toContain('dml_session=');
  });

  it('POST /api/auth/logout clears the cookie and returns 204', async () => {
    const profile = db.seedProfile();
    const session = db.seedSession(profile.id);

    const res = await t.app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: t.sessionCookie(session.id) },
    });

    expect(res.statusCode).toBe(204);
    expect(String(res.headers['set-cookie'])).toContain('dml_session=');
  });
});

function extractCookie(res: { headers: Record<string, unknown> }, name: string): string {
  const raw = res.headers['set-cookie'];
  const arr = Array.isArray(raw) ? raw : [String(raw)];
  const match = arr.find((c) => c.startsWith(`${name}=`));
  if (!match) throw new Error(`cookie ${name} not set`);
  return match.split(';')[0]!;
}
