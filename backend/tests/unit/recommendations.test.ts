import { describe, expect, it } from 'vitest';
import { RecommendationService } from '../../src/services/recommendations.js';
import { createFakePrisma } from '../helpers/prisma-fake.js';

const item = {
  mediaType: 'book' as const,
  title: 'Dune',
  creator: 'Frank Herbert',
  coverUrl: 'http://img/d.jpg',
  providerId: 'b1',
};

describe('RecommendationService', () => {
  it('creates a recommendation attributed to the user (canRemove for owner)', async () => {
    const db = createFakePrisma();
    const user = db.seedProfile({ displayName: 'Ada' });
    const svc = new RecommendationService(db.client);

    const rec = await svc.create(user.id, item);
    expect(rec).toMatchObject({
      mediaType: 'book',
      title: 'Dune',
      itemAuthor: 'Frank Herbert',
      providerId: 'b1',
      canRemove: true,
    });
    expect(rec.recommender.displayName).toBe('Ada');
  });

  it('is idempotent per (user, item) — re-recommend does not duplicate', async () => {
    const db = createFakePrisma();
    const user = db.seedProfile();
    const svc = new RecommendationService(db.client);

    const first = await svc.create(user.id, item);
    const second = await svc.create(user.id, item);
    expect(second.id).toBe(first.id);

    const list = await svc.listRecent(user.id);
    expect(list).toHaveLength(1);
  });

  it('lists community recommendations; canRemove reflects the viewer', async () => {
    const db = createFakePrisma();
    const ada = db.seedProfile({ displayName: 'Ada' });
    const bob = db.seedProfile({ displayName: 'Bob' });
    const svc = new RecommendationService(db.client);
    await svc.create(ada.id, item);

    const asBob = await svc.listRecent(bob.id);
    expect(asBob).toHaveLength(1);
    expect(asBob[0]!.recommender.displayName).toBe('Ada');
    expect(asBob[0]!.canRemove).toBe(false);
  });

  it('removes only the owner\'s recommendation', async () => {
    const db = createFakePrisma();
    const ada = db.seedProfile();
    const bob = db.seedProfile();
    const svc = new RecommendationService(db.client);
    const rec = await svc.create(ada.id, item);

    // Another user cannot remove it.
    await svc.remove(bob.id, rec.id);
    expect(await svc.listRecent(ada.id)).toHaveLength(1);

    // The owner can.
    await svc.remove(ada.id, rec.id);
    expect(await svc.listRecent(ada.id)).toHaveLength(0);
  });
});
