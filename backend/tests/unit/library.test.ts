import { describe, expect, it } from 'vitest';
import { LibraryService } from '../../src/services/library.js';
import { createFakePrisma } from '../helpers/prisma-fake.js';

const book = { mediaType: 'book' as const, title: 'Dune', creator: 'Frank Herbert', coverUrl: null, providerId: 'b1' };
const music = { mediaType: 'music' as const, title: 'Blue', creator: 'Joni Mitchell', coverUrl: null, providerId: 'm1' };

describe('LibraryService', () => {
  it('adds to the Want shelf by default (idempotent per user+item)', async () => {
    const db = createFakePrisma();
    const user = db.seedProfile();
    const svc = new LibraryService(db.client);

    const first = await svc.add(user.id, book);
    expect(first.shelf).toBe('want');
    const second = await svc.add(user.id, book);
    expect(second.id).toBe(first.id);
    expect(await svc.list(user.id)).toHaveLength(1);
  });

  it('moves an item between shelves', async () => {
    const db = createFakePrisma();
    const user = db.seedProfile();
    const svc = new LibraryService(db.client);
    const item = await svc.add(user.id, book);

    const moved = await svc.move(user.id, item.id, 'current');
    expect(moved?.shelf).toBe('current');
    expect((await svc.list(user.id, { shelf: 'current' })).map((i) => i.title)).toEqual(['Dune']);
    expect(await svc.list(user.id, { shelf: 'want' })).toHaveLength(0);
  });

  it('move returns null for a non-owned/absent item', async () => {
    const db = createFakePrisma();
    const ada = db.seedProfile();
    const bob = db.seedProfile();
    const svc = new LibraryService(db.client);
    const item = await svc.add(ada.id, book);
    expect(await svc.move(bob.id, item.id, 'read')).toBeNull();
    expect((await svc.list(ada.id))[0]!.shelf).toBe('want');
  });

  it('filters by shelf and media type; counts per shelf', async () => {
    const db = createFakePrisma();
    const user = db.seedProfile();
    const svc = new LibraryService(db.client);
    await svc.add(user.id, book); // want
    await svc.add(user.id, { ...music, shelf: 'current' });

    expect(await svc.count(user.id)).toBe(2);
    expect(await svc.count(user.id, 'want')).toBe(1);
    expect(await svc.count(user.id, 'current')).toBe(1);
    expect((await svc.list(user.id, { mediaType: 'music' })).map((i) => i.title)).toEqual(['Blue']);
    expect((await svc.list(user.id, { shelf: 'current' })).map((i) => i.title)).toEqual(['Blue']);
  });

  it('is private and removable only by the owner', async () => {
    const db = createFakePrisma();
    const ada = db.seedProfile();
    const bob = db.seedProfile();
    const svc = new LibraryService(db.client);
    const item = await svc.add(ada.id, book);

    expect(await svc.list(bob.id)).toHaveLength(0);
    await svc.remove(bob.id, item.id); // not owner → no-op
    expect(await svc.list(ada.id)).toHaveLength(1);
    await svc.remove(ada.id, item.id);
    expect(await svc.list(ada.id)).toHaveLength(0);
  });
});
