import type { PrismaClient } from '@prisma/client';
import type { RatingDTO, UpsertRatingInput } from '@dml/shared';

/**
 * Per-user star ratings of items (UI refresh). One rating per (user, item);
 * setting again updates the stars. Owner-scoped throughout.
 */
export class RatingService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Set (or update) the current user's rating for an item. */
  async upsert(userId: string, input: UpsertRatingInput): Promise<RatingDTO> {
    const row = await this.prisma.rating.upsert({
      where: {
        uq_rating_user_item: { userId, mediaType: input.mediaType, providerId: input.providerId },
      },
      update: { stars: input.stars, title: input.title, creator: input.creator ?? null, coverUrl: input.coverUrl ?? null },
      create: {
        userId,
        mediaType: input.mediaType,
        providerId: input.providerId,
        stars: input.stars,
        title: input.title,
        creator: input.creator ?? null,
        coverUrl: input.coverUrl ?? null,
      },
      select: { mediaType: true, providerId: true, stars: true },
    });
    return row;
  }

  /** Clear the current user's rating for an item. No-op if absent. */
  async remove(userId: string, mediaType: RatingDTO['mediaType'], providerId: string): Promise<void> {
    await this.prisma.rating.deleteMany({ where: { userId, mediaType, providerId } });
  }

  /** All of the current user's ratings (for the UI to show "your rating"). */
  async listForUser(userId: string): Promise<RatingDTO[]> {
    return this.prisma.rating.findMany({
      where: { userId },
      select: { mediaType: true, providerId: true, stars: true },
    });
  }
}
