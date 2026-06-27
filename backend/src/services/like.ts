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
    try {
      await this.prisma.activityLike.upsert({
        where: { uq_like_user_activity: { userId, activityId } },
        update: {},
        create: { userId, activityId },
      });
    } catch (err) {
      // The activity may have been deleted between the check and the write (FK
      // violation), or the id was malformed — treat both as not-found, not 500.
      if (this.isPrismaInputError(err)) throw notFound('Activity not found');
      throw err;
    }
    // The feed caches like counts, so refresh it.
    await this.feed.invalidate();
  }

  /** Remove the user's like from an activity (idempotent; malformed id → no-op). */
  async unlike(userId: string, activityId: string): Promise<void> {
    try {
      await this.prisma.activityLike.deleteMany({ where: { userId, activityId } });
    } catch (err) {
      if (this.isPrismaInputError(err)) return; // nothing to remove
      throw err;
    }
    await this.feed.invalidate();
  }

  private async safeFindActivity(id: string): Promise<{ id: string } | null> {
    try {
      return await this.prisma.activity.findUnique({ where: { id }, select: { id: true } });
    } catch (err) {
      if (this.isPrismaInputError(err)) return null;
      throw err;
    }
  }

  private isPrismaInputError(err: unknown): boolean {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError ||
      err instanceof Prisma.PrismaClientValidationError
    );
  }
}
