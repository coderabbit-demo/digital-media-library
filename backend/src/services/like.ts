import { Prisma, type PrismaClient } from '@prisma/client';
import { notFound } from '../plugins/errors.js';
import type { FeedService } from './feed.js';

/**
 * Likes on activity updates (UI refresh). One like per (user, activity);
 * idempotent. Like counts are read via the feed's relation count.
 */
export class LikeService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly feed: FeedService,
  ) {}

  /** Like an activity (idempotent). 404 if the activity doesn't exist. */
  async like(userId: string, activityId: string): Promise<void> {
    const activity = await this.safeFindActivity(activityId);
    if (!activity) throw notFound('Activity not found');
    await this.prisma.activityLike.upsert({
      where: { uq_like_user_activity: { userId, activityId } },
      update: {},
      create: { userId, activityId },
    });
    // The feed caches like counts, so refresh it.
    await this.feed.invalidate();
  }

  /** Remove the user's like from an activity (idempotent). */
  async unlike(userId: string, activityId: string): Promise<void> {
    await this.prisma.activityLike.deleteMany({ where: { userId, activityId } });
    await this.feed.invalidate();
  }

  private async safeFindActivity(id: string): Promise<{ id: string } | null> {
    try {
      return await this.prisma.activity.findUnique({ where: { id }, select: { id: true } });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError ||
        err instanceof Prisma.PrismaClientValidationError
      ) {
        return null;
      }
      throw err;
    }
  }
}
