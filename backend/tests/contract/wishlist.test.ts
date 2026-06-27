import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/test-app.js';
import { createFakePrisma, type FakePrisma } from '../helpers/prisma-fake.js';

/** Contract tests for /api/wishlist vs contracts/openapi.yaml. */
describe('contract: wishlist', () => {
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
    expect((await t.app.inject({ method: 'GET', url: '/api/wishlist' })).statusCode).toBe(401);
    expect((await t.app.inject({ method: 'POST', url: '/api/wishlist', payload: book })).statusCode).toBe(401);
  });

  it('POST adds (201) and GET lists it; add is idempotent', async () => {
    const { cookie } = auth();
    const res = await t.app.inject({ method: 'POST', url: '/api/wishlist', headers: { cookie }, payload: book });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ mediaType: 'book', title: 'Dune', itemAuthor: 'Frank Herbert', providerId: 'b1' });

    await t.app.inject({ method: 'POST', url: '/api/wishlist', headers: { cookie }, payload: book }); // dup
    const list = await t.app.inject({ method: 'GET', url: '/api/wishlist', headers: { cookie } });
    expect(list.json().items).toHaveLength(1);
  });

  it('GET filters by media type', async () => {
    const { cookie } = auth();
    await t.app.inject({ method: 'POST', url: '/api/wishlist', headers: { cookie }, payload: book });
    await t.app.inject({ method: 'POST', url: '/api/wishlist', headers: { cookie }, payload: { mediaType: 'music', title: 'Blue', providerId: 'm1' } });

    const books = await t.app.inject({ method: 'GET', url: '/api/wishlist?mediaType=book', headers: { cookie } });
    expect(books.json().items.map((i: { title: string }) => i.title)).toEqual(['Dune']);
    const all = await t.app.inject({ method: 'GET', url: '/api/wishlist', headers: { cookie } });
    expect(all.json().items).toHaveLength(2);
  });

  it('GET 400 on unknown mediaType filter', async () => {
    const { cookie } = auth();
    const res = await t.app.inject({ method: 'GET', url: '/api/wishlist?mediaType=movie', headers: { cookie } });
    expect(res.statusCode).toBe(400);
  });

  it('is private — another user does not see the items, and home count reflects owner only', async () => {
    const { cookie: adaCookie } = auth();
    await t.app.inject({ method: 'POST', url: '/api/wishlist', headers: { cookie: adaCookie }, payload: book });

    const bob = db.seedProfile();
    const bobCookie = t.sessionCookie(db.seedSession(bob.id).id);
    const bobList = await t.app.inject({ method: 'GET', url: '/api/wishlist', headers: { cookie: bobCookie } });
    expect(bobList.json().items).toHaveLength(0);

    const bobHome = await t.app.inject({ method: 'GET', url: '/api/home', headers: { cookie: bobCookie } });
    expect(bobHome.json().counts.wishlisted).toBe(0);
  });

  it('home wishlisted count reflects the owner\'s items', async () => {
    const { cookie } = auth();
    await t.app.inject({ method: 'POST', url: '/api/wishlist', headers: { cookie }, payload: book });
    const home = await t.app.inject({ method: 'GET', url: '/api/home', headers: { cookie } });
    expect(home.json().counts.wishlisted).toBe(1);
  });

  it('DELETE removes the owner\'s item (204)', async () => {
    const { cookie } = auth();
    const created = await t.app.inject({ method: 'POST', url: '/api/wishlist', headers: { cookie }, payload: book });
    const id = created.json().id;
    const del = await t.app.inject({ method: 'DELETE', url: `/api/wishlist/${id}`, headers: { cookie } });
    expect(del.statusCode).toBe(204);
    const list = await t.app.inject({ method: 'GET', url: '/api/wishlist', headers: { cookie } });
    expect(list.json().items).toHaveLength(0);
  });

  it('POST 400 on invalid body', async () => {
    const { cookie } = auth();
    const res = await t.app.inject({ method: 'POST', url: '/api/wishlist', headers: { cookie }, payload: { mediaType: 'book', title: '' } });
    expect(res.statusCode).toBe(400);
  });
});
