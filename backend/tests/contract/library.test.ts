import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/test-app.js';
import { createFakePrisma, type FakePrisma } from '../helpers/prisma-fake.js';

/** Contract tests for /api/library ("My Library") vs contracts/openapi.yaml. */
describe('contract: my library', () => {
  let t: TestApp;
  let db: FakePrisma;

  beforeEach(async () => {
    db = createFakePrisma();
    t = await buildTestApp({ prisma: db.client });
  });
  afterEach(async () => {
    await t.app.close();
  });

  const auth = () => {
    const user = db.seedProfile({ displayName: 'Ada' });
    return { user, cookie: t.sessionCookie(db.seedSession(user.id).id) };
  };
  const book = { mediaType: 'book', title: 'Dune', creator: 'Frank Herbert', providerId: 'b1' };

  it('requires auth on all routes', async () => {
    expect((await t.app.inject({ method: 'GET', url: '/api/library' })).statusCode).toBe(401);
    expect((await t.app.inject({ method: 'POST', url: '/api/library', payload: book })).statusCode).toBe(401);
  });

  it('POST adds at the Want shelf (201) and GET lists it; add is idempotent', async () => {
    const { cookie } = auth();
    const res = await t.app.inject({ method: 'POST', url: '/api/library', headers: { cookie }, payload: book });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ mediaType: 'book', title: 'Dune', itemAuthor: 'Frank Herbert', providerId: 'b1', shelf: 'want' });

    await t.app.inject({ method: 'POST', url: '/api/library', headers: { cookie }, payload: book }); // dup
    const list = await t.app.inject({ method: 'GET', url: '/api/library', headers: { cookie } });
    expect(list.json().items).toHaveLength(1);
  });

  it('PATCH moves an item to another shelf', async () => {
    const { cookie } = auth();
    const created = await t.app.inject({ method: 'POST', url: '/api/library', headers: { cookie }, payload: book });
    const id = created.json().id;

    const moved = await t.app.inject({ method: 'PATCH', url: `/api/library/${id}`, headers: { cookie }, payload: { shelf: 'current' } });
    expect(moved.statusCode).toBe(200);
    expect(moved.json().shelf).toBe('current');

    const current = await t.app.inject({ method: 'GET', url: '/api/library?shelf=current', headers: { cookie } });
    expect(current.json().items.map((i: { title: string }) => i.title)).toEqual(['Dune']);
  });

  it('PATCH 404 for a non-owned/absent item; 400 for invalid shelf', async () => {
    const { cookie } = auth();
    const created = await t.app.inject({ method: 'POST', url: '/api/library', headers: { cookie }, payload: book });
    const id = created.json().id;
    expect((await t.app.inject({ method: 'PATCH', url: `/api/library/${id}`, headers: { cookie }, payload: { shelf: 'nope' } })).statusCode).toBe(400);
    expect((await t.app.inject({ method: 'PATCH', url: '/api/library/00000000-0000-0000-0000-000000000000', headers: { cookie }, payload: { shelf: 'done' } })).statusCode).toBe(404);
  });

  it('GET filters by shelf and media type', async () => {
    const { cookie } = auth();
    await t.app.inject({ method: 'POST', url: '/api/library', headers: { cookie }, payload: book });
    await t.app.inject({ method: 'POST', url: '/api/library', headers: { cookie }, payload: { mediaType: 'music', title: 'Blue', providerId: 'm1', shelf: 'done' } });

    expect((await t.app.inject({ method: 'GET', url: '/api/library?shelf=done', headers: { cookie } })).json().items.map((i: { title: string }) => i.title)).toEqual(['Blue']);
    expect((await t.app.inject({ method: 'GET', url: '/api/library?mediaType=book', headers: { cookie } })).json().items.map((i: { title: string }) => i.title)).toEqual(['Dune']);
    expect((await t.app.inject({ method: 'GET', url: '/api/library', headers: { cookie } })).json().items).toHaveLength(2);
  });

  it('GET 400 on unknown shelf/mediaType filter', async () => {
    const { cookie } = auth();
    expect((await t.app.inject({ method: 'GET', url: '/api/library?shelf=movie', headers: { cookie } })).statusCode).toBe(400);
    expect((await t.app.inject({ method: 'GET', url: '/api/library?mediaType=movie', headers: { cookie } })).statusCode).toBe(400);
  });

  it('is private and feeds the home Want-to-Read count', async () => {
    const { cookie } = auth();
    await t.app.inject({ method: 'POST', url: '/api/library', headers: { cookie }, payload: book });
    const home = await t.app.inject({ method: 'GET', url: '/api/home', headers: { cookie } });
    expect(home.json().counts.wishlisted).toBe(1);

    const bob = db.seedProfile();
    const bobCookie = t.sessionCookie(db.seedSession(bob.id).id);
    expect((await t.app.inject({ method: 'GET', url: '/api/library', headers: { cookie: bobCookie } })).json().items).toHaveLength(0);
    expect((await t.app.inject({ method: 'GET', url: '/api/home', headers: { cookie: bobCookie } })).json().counts.wishlisted).toBe(0);
  });

  it('DELETE removes the owner\'s item (204)', async () => {
    const { cookie } = auth();
    const created = await t.app.inject({ method: 'POST', url: '/api/library', headers: { cookie }, payload: book });
    const del = await t.app.inject({ method: 'DELETE', url: `/api/library/${created.json().id}`, headers: { cookie } });
    expect(del.statusCode).toBe(204);
    expect((await t.app.inject({ method: 'GET', url: '/api/library', headers: { cookie } })).json().items).toHaveLength(0);
  });
});
