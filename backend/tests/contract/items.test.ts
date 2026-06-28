import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/test-app.js';
import { createFakePrisma, type FakePrisma } from '../helpers/prisma-fake.js';
import { FakeItemProvider, fakeItemProviders, makeItemDetail } from '../helpers/fake-provider.js';

/** Contract tests for /api/items/:mediaType/:providerId vs contracts/openapi.yaml. */
describe('contract: item detail', () => {
  let t: TestApp;
  let db: FakePrisma;

  const build = (itemProviders = fakeItemProviders()) =>
    buildTestApp({ prisma: db.client, itemProviders });

  beforeEach(() => {
    db = createFakePrisma();
  });
  afterEach(async () => {
    if (t) await t.app.close();
  });

  const auth = () => {
    const user = db.seedProfile({ displayName: 'Ada' });
    return { user, cookie: t.sessionCookie(db.seedSession(user.id).id) };
  };

  it('401 when unauthenticated', async () => {
    t = await build();
    expect((await t.app.inject({ method: 'GET', url: '/api/items/book/b1' })).statusCode).toBe(401);
  });

  it('400 on an unknown media type', async () => {
    t = await build();
    const { cookie } = auth();
    const res = await t.app.inject({ method: 'GET', url: '/api/items/widget/x1', headers: { cookie } });
    expect(res.statusCode).toBe(400);
  });

  it('200 ItemPageDTO with item detail + empty community stats', async () => {
    t = await build();
    const { cookie } = auth();
    const res = await t.app.inject({ method: 'GET', url: '/api/items/book/b1', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.detailAvailable).toBe(true);
    expect(body.item).toMatchObject({ mediaType: 'book', providerId: 'b1', title: 'book b1' });
    expect(Array.isArray(body.item.genres)).toBe(true);
    expect(body.stats).toMatchObject({
      ratingAverage: null,
      ratingCount: 0,
      shelfCounts: { want: 0, current: 0, done: 0, dnf: 0 },
      recentActivity: [],
    });
  });

  it('404 when unknown to the provider and absent from our DB', async () => {
    t = await buildTestApp({
      prisma: db.client,
      itemProviders: { ...fakeItemProviders(), book: new FakeItemProvider(null) },
    });
    const { cookie } = auth();
    const res = await t.app.inject({ method: 'GET', url: '/api/items/book/missing', headers: { cookie } });
    expect(res.statusCode).toBe(404);
  });

  it('200 detailAvailable:false (stats still present) when the provider lookup throws', async () => {
    const failing = new FakeItemProvider(makeItemDetail('book', 'b1'));
    failing.fail = true;
    t = await buildTestApp({
      prisma: db.client,
      itemProviders: { ...fakeItemProviders(), book: failing },
    });
    const { user, cookie } = auth();
    // Give the item a local footprint so it isn't a 404.
    db.seedRating(user.id, { mediaType: 'book', providerId: 'b1', stars: 4 });

    const res = await t.app.inject({ method: 'GET', url: '/api/items/book/b1', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.detailAvailable).toBe(false);
    expect(body.item).toBeNull();
    expect(body.stats.ratingCount).toBe(1);
  });
});
