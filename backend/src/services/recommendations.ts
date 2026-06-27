import type { PrismaClient } from '@prisma/client';
import type { CreateRecommendationInput, RecommendationDTO } from '@dml/shared';

/** Number of recent community recommendations surfaced on the home page. */
const HOME_RECOMMENDATIONS_LIMIT = 20;

const RECOMMENDATION_SELECT = {
  id: true,
  userId: true,
  mediaType: true,
  title: true,
  creator: true,
  coverUrl: true,
  providerId: true,
  createdAt: true,
  user: { select: { id: true, displayName: true, avatarUrl: true } },
} as const;

type RecommendationRow = {
  id: string;
  userId: string;
  mediaType: RecommendationDTO['mediaType'];
  title: string;
  creator: string | null;
  coverUrl: string | null;
  providerId: string;
  createdAt: Date;
  user: { id: string; displayName: string; avatarUrl: string | null };
};

/**
 * User-driven recommendations (feature 004). Add is idempotent per (user, item);
 * removal is owner-scoped; the home page lists recent community recommendations.
 */
export class RecommendationService {
  constructor(private readonly prisma: PrismaClient) {}

  private toDTO(row: RecommendationRow, currentUserId: string): RecommendationDTO {
    return {
      id: row.id,
      recommender: {
        id: row.user.id,
        displayName: row.user.displayName,
        avatarUrl: row.user.avatarUrl ?? null,
      },
      mediaType: row.mediaType,
      title: row.title,
      itemAuthor: row.creator,
      coverUrl: row.coverUrl ?? null,
      providerId: row.providerId,
      createdAt: row.createdAt.toISOString(),
      canRemove: row.userId === currentUserId,
    };
  }

  /** Create a recommendation; idempotent on (userId, mediaType, providerId). */
  async create(userId: string, input: CreateRecommendationInput): Promise<RecommendationDTO> {
    const data = {
      userId,
      mediaType: input.mediaType,
      title: input.title,
      creator: input.creator ?? null,
      coverUrl: input.coverUrl ?? null,
      providerId: input.providerId,
    };
    const row = await this.prisma.recommendation.upsert({
      where: {
        uq_recommendation_user_item: {
          userId,
          mediaType: input.mediaType,
          providerId: input.providerId,
        },
      },
      // Refresh the snapshot/timestamp on re-recommend, but stay idempotent (no dup row).
      update: { title: data.title, creator: data.creator, coverUrl: data.coverUrl },
      create: data,
      select: RECOMMENDATION_SELECT,
    });
    return this.toDTO(row, userId);
  }

  /** Remove a recommendation the user made. No-op if absent/not owned. */
  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.recommendation.deleteMany({ where: { id, userId } });
  }

  /** Recent community recommendations (most recent first) for the home page. */
  async listRecent(currentUserId: string): Promise<RecommendationDTO[]> {
    const rows = await this.prisma.recommendation.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: HOME_RECOMMENDATIONS_LIMIT,
      select: RECOMMENDATION_SELECT,
    });
    return rows.map((r) => this.toDTO(r, currentUserId));
  }
}
