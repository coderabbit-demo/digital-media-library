import { describe, expect, it } from 'vitest';
import { WishlistService } from '../../src/services/wishlist.js';
import { createFakePrisma } from '../helpers/prisma-fake.js';

const book = { mediaType: 'book' as const, title: 'Dune', creator: 'Frank Herbert', coverUrl: null, providerId: 'b1' };
const music = { mediaType: 'music' as const, title: 'Blue', creator: 'Joni Mitchell', coverUrl: null, providerId: 'm1' };

describe('WishlistService', () => {
  it('adds an item (idempotent per user+item)', async () => {
    const db = createFakePrisma();
    const user = db.seedProfile();
    const svc = new WishlistService(db.client);

    const first = await svc.add(user.id, book);
    const second = await svc.add(user.id, book);
    expect(second.id).toBe(first.id);
    expect(await svc.list(user.id)).toHaveLength(1);
    expect(first).toMatchObject({ mediaType: 'book', title: 'Dune', itemAuthor: 'Frank Herbert', providerId: 'b1' });
  });

  it('filters by media type and counts', async () => {
    const db = createFakePrisma();
    const user = db.seedProfile();
    const svc = new WishlistService(db.client);
    await svc.add(user.id, book);
    await svc.add(user.id, music);

    expect(await svc.count(user.id)).toBe(2);
    expect((await svc.list(user.id, 'book')).map((i) => i.title)).toEqual(['Dune']);
    expect((await svc.list(user.id, 'music')).map((i) => i.title)).toEqual(['Blue']);
    expect(await svc.list(user.id)).toHaveLength(2);
  });

  it('is private — one user never sees another\'s wishlist', async () => {
    const db = createFakePrisma();
    const ada = db.seedProfile();
    const bob = db.seedProfile();
    const svc = new WishlistService(db.client);
    await svc.add(ada.id, book);

    expect(await svc.list(bob.id)).toHaveLength(0);
    expect(await svc.count(bob.id)).toBe(0);
  });

  it('removes only the owner\'s item', async () => {
    const db = createFakePrisma();
    const ada = db.seedProfile();
    const bob = db.seedProfile();
    const svc = new WishlistService(db.client);
    const item = await svc.add(ada.id, book);

    await svc.remove(bob.id, item.id); // not owner → no-op
    expect(await svc.list(ada.id)).toHaveLength(1);
    await svc.remove(ada.id, item.id);
    expect(await svc.list(ada.id)).toHaveLength(0);
  });
});
