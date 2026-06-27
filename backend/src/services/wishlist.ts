import type { PrismaClient } from '@prisma/client';
import type { CreateWishlistItemInput, MediaType, WishlistItemDTO } from '@dml/shared';

const WISHLIST_SELECT = {
  id: true,
  mediaType: true,
  title: true,
  creator: true,
  coverUrl: true,
  providerId: true,
  createdAt: true,
} as const;

type WishlistRow = {
  id: string;
  mediaType: MediaType;
  title: string;
  creator: string | null;
  coverUrl: string | null;
  providerId: string;
  createdAt: Date;
};

/**
 * A user's private wishlist (feature 005). All operations are scoped to the owner
 * (`userId`); there is no cross-user read path, so wishlists are private by
 * construction (FR-006). Add is idempotent per (user, item); items are snapshots.
 */
export class WishlistService {
  constructor(private readonly prisma: PrismaClient) {}

  private toDTO(row: WishlistRow): WishlistItemDTO {
    return {
      id: row.id,
      mediaType: row.mediaType,
      title: row.title,
      itemAuthor: row.creator,
      coverUrl: row.coverUrl ?? null,
      providerId: row.providerId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** Add an item; idempotent on (userId, mediaType, providerId). */
  async add(userId: string, input: CreateWishlistItemInput): Promise<WishlistItemDTO> {
    const data = {
      userId,
      mediaType: input.mediaType,
      title: input.title,
      creator: input.creator ?? null,
      coverUrl: input.coverUrl ?? null,
      providerId: input.providerId,
    };
    const row = await this.prisma.wishlistItem.upsert({
      where: {
        uq_wishlist_user_item: {
          userId,
          mediaType: input.mediaType,
          providerId: input.providerId,
        },
      },
      update: { title: data.title, creator: data.creator, coverUrl: data.coverUrl },
      create: data,
      select: WISHLIST_SELECT,
    });
    return this.toDTO(row);
  }

  /** Remove an item the user owns. No-op if absent/not owned. */
  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.wishlistItem.deleteMany({ where: { id, userId } });
  }

  /** The owner's wishlist, most recent first, optionally filtered by media type. */
  async list(userId: string, mediaType?: MediaType): Promise<WishlistItemDTO[]> {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId, ...(mediaType ? { mediaType } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: WISHLIST_SELECT,
    });
    return rows.map((r) => this.toDTO(r));
  }

  /** Count of the owner's wishlist items (for the home counts). */
  async count(userId: string): Promise<number> {
    return this.prisma.wishlistItem.count({ where: { userId } });
  }
}
