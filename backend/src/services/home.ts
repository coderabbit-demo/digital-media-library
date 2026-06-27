import type { PrismaClient } from '@prisma/client';
import type { ActivityDTO, HomeData } from '@dml/shared';
import type { RecommendationService } from './recommendations.js';

/** Number of the user's own recent items shown in the home left column. */
const OWN_ITEMS_LIMIT = 10;

/**
 * Assembles the home payload from **local data only** (our own database) — no
 * external content-provider calls (feature 002 / FR-006). Returns the current
 * user's recent own activities, counts, and recent community recommendations
 * (feature 004). The community feed is served separately by `/feed`.
 */
export class HomeService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly recommendations: RecommendationService,
  ) {}

  async getHome(currentUserId: string): Promise<HomeData> {
    const [rows, currentlyOn, recommendations] = await Promise.all([
      this.prisma.activity.findMany({
        where: { userId: currentUserId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: OWN_ITEMS_LIMIT,
        select: {
          id: true,
          mediaType: true,
          title: true,
          author: true,
          createdAt: true,
          user: { select: { id: true, displayName: true, avatarUrl: true } },
        },
      }),
      this.prisma.activity.count({ where: { userId: currentUserId } }),
      this.recommendations.listRecent(currentUserId),
    ]);

    const ownItems: ActivityDTO[] = rows.map((a) => ({
      id: a.id,
      author: {
        id: a.user.id,
        displayName: a.user.displayName,
        avatarUrl: a.user.avatarUrl ?? null,
      },
      mediaType: a.mediaType,
      title: a.title,
      itemAuthor: a.author,
      createdAt: a.createdAt.toISOString(),
      // These are the current user's own items by construction.
      canDelete: true,
    }));

    return {
      ownItems,
      counts: {
        currentlyOn,
        // Placeholder until feature 005 (wishlist) exists.
        wishlisted: 0,
      },
      recommendations,
    };
  }
}
