import type { PrismaClient } from '@prisma/client';
import type { CreateLibraryItemInput, LibraryItemDTO, MediaType, Shelf } from '@dml/shared';

const LIBRARY_SELECT = {
  id: true,
  mediaType: true,
  title: true,
  creator: true,
  coverUrl: true,
  providerId: true,
  shelf: true,
  createdAt: true,
  updatedAt: true,
} as const;

type LibraryRow = {
  id: string;
  mediaType: MediaType;
  title: string;
  creator: string | null;
  coverUrl: string | null;
  providerId: string;
  shelf: Shelf;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * A user's private library (feature 005, "My Library"). Each item sits on exactly
 * one shelf (Goodreads-style). All operations are scoped to the owner (`userId`);
 * there is no cross-user read path, so libraries are private by construction. Add
 * is idempotent per (user, item); items are snapshots.
 */
export class LibraryService {
  constructor(private readonly prisma: PrismaClient) {}

  private toDTO(row: LibraryRow): LibraryItemDTO {
    return {
      id: row.id,
      mediaType: row.mediaType,
      title: row.title,
      itemAuthor: row.creator,
      coverUrl: row.coverUrl ?? null,
      providerId: row.providerId,
      shelf: row.shelf,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Add an item to the library; idempotent on (userId, mediaType, providerId).
   * Defaults to the "want" shelf. If a shelf is supplied (or the item already
   * exists), the item is placed/moved onto that shelf.
   */
  async add(userId: string, input: CreateLibraryItemInput): Promise<LibraryItemDTO> {
    const shelf: Shelf = input.shelf ?? 'want';
    const row = await this.prisma.libraryItem.upsert({
      where: {
        uq_library_user_item: {
          userId,
          mediaType: input.mediaType,
          providerId: input.providerId,
        },
      },
      update: {
        title: input.title,
        creator: input.creator ?? null,
        coverUrl: input.coverUrl ?? null,
        // Only change the shelf on re-add when the caller explicitly asked.
        ...(input.shelf ? { shelf: input.shelf } : {}),
      },
      create: {
        userId,
        mediaType: input.mediaType,
        title: input.title,
        creator: input.creator ?? null,
        coverUrl: input.coverUrl ?? null,
        providerId: input.providerId,
        shelf,
      },
      select: LIBRARY_SELECT,
    });
    return this.toDTO(row);
  }

  /** Move an item the user owns to a different shelf. Returns null if not found/owned. */
  async move(userId: string, id: string, shelf: Shelf): Promise<LibraryItemDTO | null> {
    const result = await this.prisma.libraryItem.updateMany({ where: { id, userId }, data: { shelf } });
    if (result.count === 0) return null;
    const row = await this.prisma.libraryItem.findUnique({ where: { id }, select: LIBRARY_SELECT });
    return row ? this.toDTO(row) : null;
  }

  /** Remove an item the user owns. No-op if absent/not owned. */
  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.libraryItem.deleteMany({ where: { id, userId } });
  }

  /** The owner's library, most recent first, optionally filtered by shelf and/or media type. */
  async list(userId: string, opts: { shelf?: Shelf; mediaType?: MediaType } = {}): Promise<LibraryItemDTO[]> {
    const rows = await this.prisma.libraryItem.findMany({
      where: {
        userId,
        ...(opts.shelf ? { shelf: opts.shelf } : {}),
        ...(opts.mediaType ? { mediaType: opts.mediaType } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: LIBRARY_SELECT,
    });
    return rows.map((r) => this.toDTO(r));
  }

  /** Count the owner's items, optionally on a single shelf (for home counts). */
  async count(userId: string, shelf?: Shelf): Promise<number> {
    return this.prisma.libraryItem.count({ where: { userId, ...(shelf ? { shelf } : {}) } });
  }
}
