import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { HomeService } from '../../src/services/home.js';
import { RecommendationService } from '../../src/services/recommendations.js';
import { LibraryService } from '../../src/services/library.js';
import { createFakePrisma } from '../helpers/prisma-fake.js';

/** HomeService wired with real Recommendation + Library services over the fake prisma. */
const makeHome = (client: PrismaClient) =>
  new HomeService(client, new RecommendationService(client), new LibraryService(client));

/** Unit tests for HomeService aggregation (local data only). */
describe('HomeService', () => {
  it('returns the My Library "current" shelf as the currently list, with counts', async () => {
    const db = createFakePrisma();
    const user = db.seedProfile({ displayName: 'Ada' });
    db.seedLibraryItem(user.id, { title: 'Dune', shelf: 'current' });
    db.seedLibraryItem(user.id, { title: 'On The Shelf', shelf: 'want' });

    const data = await makeHome(db.client).getHome(user.id);

    expect(data.current.map((i) => i.title)).toEqual(['Dune']);
    expect(data.current.every((i) => i.shelf === 'current')).toBe(true);
    expect(data.counts).toEqual({ currentlyOn: 1, wishlisted: 1 });
    expect(data.recommendations).toEqual([]);
  });

  it('is private — excludes other users\' library items', async () => {
    const db = createFakePrisma();
    const a = db.seedProfile({ displayName: 'Ada' });
    const b = db.seedProfile({ displayName: 'Bob' });
    db.seedLibraryItem(a.id, { title: 'A1', shelf: 'current' });
    db.seedLibraryItem(b.id, { title: 'B1', shelf: 'current' });

    const data = await makeHome(db.client).getHome(a.id);
    expect(data.current.map((i) => i.title)).toEqual(['A1']);
    expect(data.counts.currentlyOn).toBe(1);
  });

  it('returns empty data for a user with nothing on the current shelf', async () => {
    const db = createFakePrisma();
    const user = db.seedProfile();
    const data = await makeHome(db.client).getHome(user.id);
    expect(data.current).toEqual([]);
    expect(data.counts.currentlyOn).toBe(0);
  });
});
