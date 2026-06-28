import type { PrismaClient } from '@prisma/client';
import {
  ITEM_ACTIVITY_LIMIT,
  SHELVES,
  type ItemStatsDTO,
  type MediaType,
  type ShelfCountsDTO,
} from '@dml/shared';

/**
 * Community aggregates for an item, computed from our own database (feature 007):
 * rating average + count (Rating), per-shelf distinct-user counts (LibraryItem,
 * one row per user), and recent feed activity referencing the item (Activity).
 * All queries are bounded and filter on (mediaType, providerId).
 */
export class ItemStatsService {
  constructor(private readonly prisma: PrismaClient) {}

  async getStats(mediaType: MediaType, providerId: string): Promise<ItemStatsDTO> {
    const where = { mediaType, providerId };

    const [ratingAgg, shelfGroups, activities] = await Promise.all([
      this.prisma.rating.aggregate({ where, _avg: { stars: true }, _count: true }),
      this.prisma.libraryItem.groupBy({ by: ['shelf'], where, _count: { _all: true } }),
      this.prisma.activity.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: ITEM_ACTIVITY_LIMIT,
        select: {
          id: true,
          note: true,
          createdAt: true,
          user: { select: { id: true, displayName: true, avatarUrl: true } },
        },
      }),
    ]);

    const ratingCount = ratingAgg._count;
    const avg = ratingAgg._avg.stars;
    const ratingAverage = ratingCount > 0 && avg != null ? Math.round(avg * 10) / 10 : null;

    const shelfCounts: ShelfCountsDTO = { want: 0, current: 0, done: 0, dnf: 0 };
    for (const g of shelfGroups) {
      if ((SHELVES as readonly string[]).includes(g.shelf)) {
        shelfCounts[g.shelf as keyof ShelfCountsDTO] = g._count._all;
      }
    }

    const recentActivity = activities.map((a) => ({
      id: a.id,
      author: { id: a.user.id, displayName: a.user.displayName, avatarUrl: a.user.avatarUrl },
      note: a.note,
      createdAt: a.createdAt.toISOString(),
    }));

    return { ratingAverage, ratingCount, shelfCounts, recentActivity };
  }
}
