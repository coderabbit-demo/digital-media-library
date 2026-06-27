import type { PrismaClient } from '@prisma/client';
import type { ActivityDTO, FeedPageDTO, MediaType } from '@dml/shared';
import type { CacheService } from './cache.js';
import type { AppConfig } from '../config/index.js';
import { badRequest } from '../plugins/errors.js';

/** Logical prefix for every cached feed page; lets us invalidate all at once. */
export const FEED_CACHE_PREFIX = 'feed:page:';

interface CursorPayload {
  createdAt: string; // ISO timestamp of the last seen row
  id: string; // tiebreaker id of the last seen row
}

/** Encode the keyset cursor as opaque base64url. */
export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/** Decode an opaque cursor; throws 400 on malformed input. */
export function decodeCursor(cursor: string): CursorPayload {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as Partial<CursorPayload>;
    if (typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') {
      throw new Error('missing fields');
    }
    // Validate the timestamp is real.
    if (Number.isNaN(Date.parse(parsed.createdAt))) throw new Error('bad timestamp');
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw badRequest('Invalid feed cursor');
  }
}

/**
 * Global activity feed with keyset pagination ordered by
 * (createdAt DESC, id DESC) — stable under inserts (FR-011, research §6).
 *
 * The first, uncursored page is identical for every viewer except for the
 * per-viewer `canDelete` flag, so it is cached as raw rows (viewer-agnostic)
 * with a short TTL and `canDelete` is computed per request after read.
 */
export class FeedService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly cache: CacheService,
    private readonly config: AppConfig,
  ) {}

  /**
   * Fetch a page of the feed for `currentUserId`.
   * Returns the page plus whether the first-page cache was hit (for logging).
   */
  async getPage(
    currentUserId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ page: FeedPageDTO; cacheHit: boolean }> {
    const { limit } = opts;
    const isFirstPage = !opts.cursor;
    const cacheKey = `${FEED_CACHE_PREFIX}first:${limit}`;

    let rows: FeedRow[] | null = null;
    let cacheHit = false;

    if (isFirstPage) {
      const cached = await this.cache.get<FeedRow[]>(cacheKey);
      if (cached) {
        rows = cached;
        cacheHit = true;
      }
    }

    if (rows === null) {
      rows = await this.queryRows(opts.cursor, limit);
      if (isFirstPage) {
        await this.cache.set(cacheKey, rows, this.config.FEED_CACHE_TTL_SECONDS);
      }
    }

    const items = rows.map((row) => this.toActivityDTO(row, currentUserId));
    const nextCursor =
      rows.length === limit && rows.length > 0
        ? encodeCursor({ createdAt: rows[rows.length - 1]!.createdAt, id: rows[rows.length - 1]!.id })
        : null;

    return { page: { items, nextCursor }, cacheHit };
  }

  /** Invalidate every cached feed page (called on create/delete). */
  async invalidate(): Promise<void> {
    await this.cache.delByPrefix(FEED_CACHE_PREFIX);
  }

  /** Run the keyset query and return viewer-agnostic rows. */
  private async queryRows(cursor: string | undefined, limit: number): Promise<FeedRow[]> {
    const decoded = cursor ? decodeCursor(cursor) : undefined;

    const activities = await this.prisma.activity.findMany({
      take: limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      // Keyset predicate: rows strictly older than the cursor in (createdAt, id).
      where: decoded
        ? {
            OR: [
              { createdAt: { lt: new Date(decoded.createdAt) } },
              { createdAt: new Date(decoded.createdAt), id: { lt: decoded.id } },
            ],
          }
        : undefined,
      select: {
        id: true,
        mediaType: true,
        title: true,
        author: true,
        note: true,
        createdAt: true,
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        // Conversation size (excluding deleted tombstones) — feature 006.
        _count: { select: { replies: { where: { deletedAt: null } } } },
      },
    });

    return activities.map((a) => ({
      id: a.id,
      mediaType: a.mediaType,
      title: a.title,
      itemAuthor: a.author,
      note: a.note,
      replyCount: a._count.replies,
      createdAt: a.createdAt.toISOString(),
      author: {
        id: a.user.id,
        displayName: a.user.displayName,
        avatarUrl: a.user.avatarUrl ?? null,
      },
    }));
  }

  /** Add the per-viewer canDelete flag to a cached/queried row. */
  private toActivityDTO(row: FeedRow, currentUserId: string): ActivityDTO {
    return {
      id: row.id,
      author: row.author,
      mediaType: row.mediaType,
      title: row.title,
      itemAuthor: row.itemAuthor,
      note: row.note,
      replyCount: row.replyCount,
      createdAt: row.createdAt,
      canDelete: row.author.id === currentUserId,
    };
  }
}

/** Viewer-agnostic cached row (everything except canDelete). */
interface FeedRow {
  id: string;
  mediaType: MediaType;
  title: string;
  itemAuthor: string | null;
  note: string | null;
  replyCount: number;
  createdAt: string;
  author: { id: string; displayName: string; avatarUrl: string | null };
}
