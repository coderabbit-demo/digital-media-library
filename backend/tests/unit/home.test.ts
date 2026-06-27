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
  it('returns own items newest-first with canDelete=true and correct counts', async () => {
    const db = createFakePrisma();
    const user = db.seedProfile({ displayName: 'Ada' });
    db.seedActivity(user.id, { title: 'Old', createdAt: new Date('2026-01-01T00:00:00Z') });
    db.seedActivity(user.id, { title: 'New', createdAt: new Date('2026-02-01T00:00:00Z') });

    const home = makeHome(db.client);
    const data = await home.getHome(user.id);

    expect(data.ownItems.map((i) => i.title)).toEqual(['New', 'Old']);
    expect(data.ownItems.every((i) => i.canDelete)).toBe(true);
    expect(data.counts).toEqual({ currentlyOn: 2, wishlisted: 0 });
    expect(data.recommendations).toEqual([]);
  });

  it('excludes other users\' activities', async () => {
    const db = createFakePrisma();
    const a = db.seedProfile({ displayName: 'Ada' });
    const b = db.seedProfile({ displayName: 'Bob' });
    db.seedActivity(a.id, { title: 'A1' });
    db.seedActivity(b.id, { title: 'B1' });

    const home = makeHome(db.client);
    const data = await home.getHome(a.id);

    expect(data.ownItems.map((i) => i.title)).toEqual(['A1']);
    expect(data.counts.currentlyOn).toBe(1);
  });

  it('returns empty data for a user with no activity', async () => {
    const db = createFakePrisma();
    const user = db.seedProfile();
    const data = await makeHome(db.client).getHome(user.id);
    expect(data.ownItems).toEqual([]);
    expect(data.counts.currentlyOn).toBe(0);
  });
});
