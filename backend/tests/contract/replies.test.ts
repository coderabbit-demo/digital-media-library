import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/test-app.js';
import { createFakePrisma, type FakePrisma } from '../helpers/prisma-fake.js';

/** Contract tests for conversations (feature 006) vs contracts/openapi.yaml. */
describe('contract: conversations (replies + notes)', () => {
  let t: TestApp;
  let db: FakePrisma;

  beforeEach(async () => {
    db = createFakePrisma();
    t = await buildTestApp({ prisma: db.client });
  });
  afterEach(async () => {
    await t.app.close();
  });

  const user = (name = 'Ada') => {
    const u = db.seedProfile({ displayName: name });
    return { u, cookie: t.sessionCookie(db.seedSession(u.id).id) };
  };

  it('POST a reply returns 201 and GET lists it with author + relative fields', async () => {
    const { u, cookie } = user('Ada');
    const activity = db.seedActivity(u.id, { title: 'Dune' });

    const res = await t.app.inject({
      method: 'POST',
      url: `/api/activities/${activity.id}/replies`,
      headers: { cookie },
      payload: { body: 'Loved this!' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ activityId: activity.id, parentId: null, body: 'Loved this!', deleted: false, canDelete: true });
    expect(res.json().author).toMatchObject({ id: u.id, displayName: 'Ada' });

    const thread = await t.app.inject({ method: 'GET', url: `/api/activities/${activity.id}/replies`, headers: { cookie } });
    expect(thread.statusCode).toBe(200);
    expect(thread.json()).toMatchObject({ activityId: activity.id, count: 1 });
    expect(thread.json().replies).toHaveLength(1);
  });

  it('supports nested replies and rejects a parent from another activity', async () => {
    const { u, cookie } = user();
    const a1 = db.seedActivity(u.id, { title: 'A1' });
    const a2 = db.seedActivity(u.id, { title: 'A2' });
    const top = await t.app.inject({ method: 'POST', url: `/api/activities/${a1.id}/replies`, headers: { cookie }, payload: { body: 'top' } });
    const topId = top.json().id;

    const nested = await t.app.inject({ method: 'POST', url: `/api/activities/${a1.id}/replies`, headers: { cookie }, payload: { body: 'child', parentId: topId } });
    expect(nested.statusCode).toBe(201);
    expect(nested.json().parentId).toBe(topId);

    // A parent from a different activity is rejected.
    const bad = await t.app.inject({ method: 'POST', url: `/api/activities/${a2.id}/replies`, headers: { cookie }, payload: { body: 'x', parentId: topId } });
    expect(bad.statusCode).toBe(400);
  });

  it('validates non-empty body and unknown activity', async () => {
    const { u, cookie } = user();
    const activity = db.seedActivity(u.id);
    expect((await t.app.inject({ method: 'POST', url: `/api/activities/${activity.id}/replies`, headers: { cookie }, payload: { body: '   ' } })).statusCode).toBe(400);
    expect((await t.app.inject({ method: 'POST', url: `/api/activities/00000000-0000-0000-0000-000000000000/replies`, headers: { cookie }, payload: { body: 'hi' } })).statusCode).toBe(404);
  });

  it('requires auth', async () => {
    const { u } = user();
    const activity = db.seedActivity(u.id);
    expect((await t.app.inject({ method: 'GET', url: `/api/activities/${activity.id}/replies` })).statusCode).toBe(401);
    expect((await t.app.inject({ method: 'POST', url: `/api/activities/${activity.id}/replies`, payload: { body: 'hi' } })).statusCode).toBe(401);
  });

  it('hard-deletes a childless reply; 403 on another user\'s reply', async () => {
    const owner = user('Owner');
    const activity = db.seedActivity(owner.u.id);
    const created = await t.app.inject({ method: 'POST', url: `/api/activities/${activity.id}/replies`, headers: { cookie: owner.cookie }, payload: { body: 'mine' } });
    const id = created.json().id;

    const other = user('Other');
    expect((await t.app.inject({ method: 'DELETE', url: `/api/replies/${id}`, headers: { cookie: other.cookie } })).statusCode).toBe(403);

    expect((await t.app.inject({ method: 'DELETE', url: `/api/replies/${id}`, headers: { cookie: owner.cookie } })).statusCode).toBe(204);
    const thread = await t.app.inject({ method: 'GET', url: `/api/activities/${activity.id}/replies`, headers: { cookie: owner.cookie } });
    expect(thread.json().replies).toHaveLength(0);
  });

  it('tombstones a reply that has children (thread stays coherent)', async () => {
    const { u, cookie } = user();
    const activity = db.seedActivity(u.id);
    const parent = await t.app.inject({ method: 'POST', url: `/api/activities/${activity.id}/replies`, headers: { cookie }, payload: { body: 'parent' } });
    const parentId = parent.json().id;
    await t.app.inject({ method: 'POST', url: `/api/activities/${activity.id}/replies`, headers: { cookie }, payload: { body: 'child', parentId } });

    expect((await t.app.inject({ method: 'DELETE', url: `/api/replies/${parentId}`, headers: { cookie } })).statusCode).toBe(204);

    const thread = await t.app.inject({ method: 'GET', url: `/api/activities/${activity.id}/replies`, headers: { cookie } });
    const replies = thread.json().replies;
    // Both rows remain (tombstone + child); the tombstone is marked deleted with empty body.
    expect(replies).toHaveLength(2);
    const tomb = replies.find((r: { id: string }) => r.id === parentId);
    expect(tomb).toMatchObject({ deleted: true, body: '', canDelete: false });
    // Count excludes the deleted tombstone.
    expect(thread.json().count).toBe(1);
  });

  it('enforces the per-user reply rate limit (429 with Retry-After)', async () => {
    const { u, cookie } = user();
    const activity = db.seedActivity(u.id);
    for (let i = 0; i < 10; i++) {
      const ok = await t.app.inject({ method: 'POST', url: `/api/activities/${activity.id}/replies`, headers: { cookie }, payload: { body: `r${i}` } });
      expect(ok.statusCode).toBe(201);
    }
    const limited = await t.app.inject({ method: 'POST', url: `/api/activities/${activity.id}/replies`, headers: { cookie }, payload: { body: 'one too many' } });
    expect(limited.statusCode).toBe(429);
    expect(limited.headers).toHaveProperty('retry-after');
  });

  it('activity note round-trips and feed/home expose note + replyCount', async () => {
    const { cookie } = user();
    const created = await t.app.inject({ method: 'POST', url: '/api/activities', headers: { cookie }, payload: { mediaType: 'book', title: 'Dune', note: 'My thoughts' } });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ note: 'My thoughts', replyCount: 0 });
    const id = created.json().id;

    await t.app.inject({ method: 'POST', url: `/api/activities/${id}/replies`, headers: { cookie }, payload: { body: 'first!' } });

    const feed = await t.app.inject({ method: 'GET', url: '/api/feed', headers: { cookie } });
    const item = feed.json().items.find((i: { id: string }) => i.id === id);
    expect(item).toMatchObject({ note: 'My thoughts', replyCount: 1 });
  });
});
