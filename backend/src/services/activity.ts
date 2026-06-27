import { Prisma, type PrismaClient } from '@prisma/client';
import type { ActivityDTO, CreateActivityInput } from '@dml/shared';
import type { FeedService } from './feed.js';
import { forbidden, notFound } from '../plugins/errors.js';

/** Create and delete activity posts with per-request ownership checks. */
export class ActivityService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly feed: FeedService,
  ) {}

  /**
   * Create an activity attributed to `userId`. Text is stored verbatim (plain
   * text — FR-018; the API never renders it as markup). Invalidates the feed
   * cache so the new post appears at the head within seconds (SC-004).
   */
  async create(userId: string, input: CreateActivityInput): Promise<ActivityDTO> {
    const activity = await this.prisma.activity.create({
      data: {
        userId,
        mediaType: input.mediaType,
        title: input.title,
        author: input.itemAuthor ?? null,
        note: input.note ?? null,
      },
      select: {
        id: true,
        mediaType: true,
        title: true,
        author: true,
        note: true,
        createdAt: true,
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    await this.feed.invalidate();

    return {
      id: activity.id,
      author: {
        id: activity.user.id,
        displayName: activity.user.displayName,
        avatarUrl: activity.user.avatarUrl ?? null,
      },
      mediaType: activity.mediaType,
      title: activity.title,
      itemAuthor: activity.author,
      note: activity.note,
      // A freshly created activity has no replies yet.
      replyCount: 0,
      createdAt: activity.createdAt.toISOString(),
      // The author is, by definition, the current user.
      canDelete: true,
    };
  }

  /**
   * Delete an activity owned by `userId`.
   *  - 404 when no activity with that id exists.
   *  - 403 when it exists but belongs to another user (FR-017/SC-006).
   * Invalidates the feed cache on success.
   */
  async delete(userId: string, id: string): Promise<void> {
    // Look up ownership first to distinguish 404 from 403.
    const existing = await this.findById(id);
    if (!existing) throw notFound('Activity not found');
    if (existing.userId !== userId) throw forbidden('You can only delete your own activities');

    // Delete scoped by both id AND userId as defense-in-depth against races.
    await this.prisma.activity.deleteMany({ where: { id, userId } });
    await this.feed.invalidate();
  }

  private async findById(id: string): Promise<{ userId: string } | null> {
    // Guard against malformed UUIDs surfacing as a 500 from the DB driver.
    try {
      return await this.prisma.activity.findUnique({ where: { id }, select: { userId: true } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError || err instanceof Prisma.PrismaClientValidationError) {
        return null;
      }
      throw err;
    }
  }
}
