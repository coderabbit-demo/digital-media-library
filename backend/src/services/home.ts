import type { PrismaClient } from '@prisma/client';
import type { HomeData } from '@dml/shared';
import type { RecommendationService } from './recommendations.js';
import type { LibraryService } from './library.js';

/**
 * Assembles the home payload from **local data only** (our own database) — no
 * external content-provider calls (feature 002 / FR-006). The "Currently
 * reading/listening" list mirrors the user's My Library `current` shelf, plus
 * counts and recent community recommendations. The community feed is served by `/feed`.
 */
export class HomeService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly recommendations: RecommendationService,
    private readonly library: LibraryService,
  ) {}

  async getHome(currentUserId: string): Promise<HomeData> {
    const [current, recommendations, wishlisted] = await Promise.all([
      // Currently reading/listening = the My Library "current" shelf (always matches).
      this.library.list(currentUserId, { shelf: 'current' }),
      this.recommendations.listRecent(currentUserId),
      // Home "want to read" stat = the Want to Read shelf count.
      this.library.count(currentUserId, 'want'),
    ]);

    return {
      current,
      counts: {
        currentlyOn: current.length,
        wishlisted,
      },
      recommendations,
    };
  }
}
