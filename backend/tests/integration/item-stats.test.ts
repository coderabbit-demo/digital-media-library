import { beforeEach, describe, expect, it } from 'vitest';
import { createFakePrisma, type FakePrisma } from '../helpers/prisma-fake.js';
import { ItemStatsService } from '../../src/services/item-stats.js';

/** Integration: item community aggregates computed from our own data (feature 007). */
describe('integration: item stats aggregation', () => {
  let db: FakePrisma;
  let stats: ItemStatsService;

  beforeEach(() => {
    db = createFakePrisma();
    stats = new ItemStatsService(db.client);
  });

  it('computes rating average (1 decimal) + count over the item only', async () => {
    const u1 = db.seedProfile();
    const u2 = db.seedProfile();
    const u3 = db.seedProfile();
    db.seedRating(u1.id, { mediaType: 'book', providerId: 'b1', stars: 5 });
    db.seedRating(u2.id, { mediaType: 'book', providerId: 'b1', stars: 4 });
    db.seedRating(u3.id, { mediaType: 'book', providerId: 'b1', stars: 4 });
    // A different item's rating must not bleed in.
    db.seedRating(u1.id, { mediaType: 'book', providerId: 'OTHER', stars: 1 });

    const result = await stats.getStats('book', 'b1');
    expect(result.ratingCount).toBe(3);
    expect(result.ratingAverage).toBe(4.3); // (5+4+4)/3 = 4.333 → 4.3
  });

  it('counts users per shelf and zero-fills empty shelves', async () => {
    const u1 = db.seedProfile();
    const u2 = db.seedProfile();
    const u3 = db.seedProfile();
    db.seedLibraryItem(u1.id, { mediaType: 'book', providerId: 'b1', shelf: 'current' });
    db.seedLibraryItem(u2.id, { mediaType: 'book', providerId: 'b1', shelf: 'current' });
    db.seedLibraryItem(u3.id, { mediaType: 'book', providerId: 'b1', shelf: 'want' });

    const result = await stats.getStats('book', 'b1');
    expect(result.shelfCounts).toEqual({ want: 1, current: 2, done: 0, dnf: 0 });
  });

  it('lists recent activity for the item newest-first, capped at 10', async () => {
    const u1 = db.seedProfile({ displayName: 'Ada' });
    for (let i = 0; i < 12; i++) {
      db.seedActivity(u1.id, {
        mediaType: 'book',
        providerId: 'b1',
        note: `note ${i}`,
        createdAt: new Date(2026, 0, 1, 0, i),
      });
    }
    // Other-item activity must be excluded.
    db.seedActivity(u1.id, { mediaType: 'book', providerId: 'OTHER', note: 'nope' });

    const result = await stats.getStats('book', 'b1');
    expect(result.recentActivity).toHaveLength(10);
    expect(result.recentActivity[0].note).toBe('note 11'); // newest first
    expect(result.recentActivity[0].author.displayName).toBe('Ada');
    expect(result.recentActivity.every((a) => a.note !== 'nope')).toBe(true);
  });

  it('returns empty states for an item with no data', async () => {
    const result = await stats.getStats('music', 'never-seen');
    expect(result).toEqual({
      ratingAverage: null,
      ratingCount: 0,
      shelfCounts: { want: 0, current: 0, done: 0, dnf: 0 },
      recentActivity: [],
    });
  });
});
