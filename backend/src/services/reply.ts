import { Prisma, type PrismaClient } from '@prisma/client';
import type { CreateReplyInput, ReplyDTO, ReplyThreadDTO } from '@dml/shared';
import { badRequest, forbidden, notFound } from '../plugins/errors.js';
import type { FeedService } from './feed.js';

const REPLY_SELECT = {
  id: true,
  activityId: true,
  parentId: true,
  userId: true,
  body: true,
  createdAt: true,
  deletedAt: true,
  user: { select: { id: true, displayName: true, avatarUrl: true } },
} as const;

type ReplyRow = {
  id: string;
  activityId: string;
  parentId: string | null;
  userId: string;
  body: string;
  createdAt: Date;
  deletedAt: Date | null;
  user: { id: string; displayName: string; avatarUrl: string | null };
};

/**
 * Conversations on activity updates (feature 006). Replies are plain text, may
 * nest (parentId), and are visible to all authenticated users. Deleting an
 * activity cascades its replies. Deleting a reply hard-deletes it when childless,
 * or tombstones it (deletedAt) when it has children so the thread stays coherent.
 */
export class ReplyService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly feed: FeedService,
  ) {}

  private toDTO(row: ReplyRow, currentUserId: string): ReplyDTO {
    const deleted = row.deletedAt !== null;
    return {
      id: row.id,
      activityId: row.activityId,
      parentId: row.parentId,
      author: {
        id: row.user.id,
        displayName: row.user.displayName,
        avatarUrl: row.user.avatarUrl ?? null,
      },
      body: deleted ? '' : row.body,
      createdAt: row.createdAt.toISOString(),
      deleted,
      canDelete: !deleted && row.userId === currentUserId,
    };
  }

  /** Create a reply on an activity, optionally nested under a parent reply. */
  async create(userId: string, activityId: string, input: CreateReplyInput): Promise<ReplyDTO> {
    const activity = await this.safeFindActivity(activityId);
    if (!activity) throw notFound('Activity not found');

    if (input.parentId) {
      const parent = await this.prisma.reply.findUnique({
        where: { id: input.parentId },
        select: { id: true, activityId: true },
      });
      // The parent must exist and belong to the same conversation.
      if (!parent || parent.activityId !== activityId) {
        throw badRequest('Parent reply does not belong to this activity');
      }
    }

    const row = await this.prisma.reply.create({
      data: { activityId, userId, parentId: input.parentId ?? null, body: input.body },
      select: REPLY_SELECT,
    });
    // The feed embeds reply counts, so refresh it.
    await this.feed.invalidate();
    return this.toDTO(row, userId);
  }

  /** The full conversation for an activity (flat; client builds the tree). */
  async list(activityId: string, currentUserId: string): Promise<ReplyThreadDTO> {
    const rows = await this.prisma.reply.findMany({
      where: { activityId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: REPLY_SELECT,
    });
    const replies = rows.map((r) => this.toDTO(r, currentUserId));
    return {
      activityId,
      replies,
      count: replies.filter((r) => !r.deleted).length,
    };
  }

  /**
   * Delete a reply the user authored.
   *  - 404 when absent; 403 when owned by someone else.
   *  - Hard delete when it has no children; tombstone (deletedAt) when it does.
   */
  async delete(userId: string, replyId: string): Promise<void> {
    const reply = await this.safeFindReply(replyId);
    if (!reply) throw notFound('Reply not found');
    if (reply.userId !== userId) throw forbidden('You can only delete your own replies');

    // Decide tombstone-vs-hard-delete atomically: the child-count check and the
    // write run in one transaction so a concurrent nested reply can't slip in
    // between and get orphaned by a hard delete.
    await this.prisma.$transaction(async (tx) => {
      const childCount = await tx.reply.count({ where: { parentId: replyId } });
      if (childCount > 0) {
        // Keep the row as a tombstone so child replies retain context.
        await tx.reply.update({ where: { id: replyId }, data: { deletedAt: new Date() } });
      } else {
        await tx.reply.deleteMany({ where: { id: replyId, userId } });
      }
    });
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

  private async safeFindReply(id: string): Promise<{ userId: string } | null> {
    try {
      return await this.prisma.reply.findUnique({ where: { id }, select: { userId: true } });
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
