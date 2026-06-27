import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

/**
 * Minimal in-memory PrismaClient fake for CONTRACT tests, which only assert
 * request/response shapes and status codes — not real SQL behavior. It
 * implements just the subset of methods the services call. Integration tests
 * use a real PostgreSQL via Testcontainers instead.
 */
interface ProfileRow {
  id: string;
  googleSub: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}
interface ActivityRow {
  id: string;
  userId: string;
  mediaType: string;
  title: string;
  author: string | null;
  note: string | null;
  coverUrl: string | null;
  providerId: string | null;
  description: string | null;
  providerUrl: string | null;
  createdAt: Date;
}
interface ReplyRow {
  id: string;
  activityId: string;
  userId: string;
  parentId: string | null;
  body: string;
  createdAt: Date;
  deletedAt: Date | null;
}
interface SessionRow {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  lastSeenAt: Date;
}
interface RecommendationRow {
  id: string;
  userId: string;
  mediaType: string;
  title: string;
  creator: string | null;
  coverUrl: string | null;
  providerId: string;
  createdAt: Date;
}
type LibraryRow = RecommendationRow & {
  shelf: string;
  description: string | null;
  providerUrl: string | null;
  updatedAt: Date;
};
interface RatingRow {
  id: string;
  userId: string;
  mediaType: string;
  providerId: string;
  stars: number;
  title: string;
  creator: string | null;
  coverUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}
interface LikeRow {
  id: string;
  userId: string;
  activityId: string;
  createdAt: Date;
}

export interface FakePrisma {
  client: PrismaClient;
  seedProfile(partial?: Partial<ProfileRow>): ProfileRow;
  seedActivity(userId: string, partial?: Partial<ActivityRow>): ActivityRow;
  seedSession(userId: string, partial?: Partial<SessionRow>): SessionRow;
  seedRecommendation(userId: string, partial?: Partial<RecommendationRow>): RecommendationRow;
  seedLibraryItem(userId: string, partial?: Partial<LibraryRow>): LibraryRow;
  seedReply(activityId: string, userId: string, partial?: Partial<ReplyRow>): ReplyRow;
}

export function createFakePrisma(): FakePrisma {
  const profiles = new Map<string, ProfileRow>();
  const activities = new Map<string, ActivityRow>();
  const sessions = new Map<string, SessionRow>();
  const recommendations = new Map<string, RecommendationRow>();
  const library = new Map<string, LibraryRow>();
  const replies = new Map<string, ReplyRow>();
  const ratings = new Map<string, RatingRow>();
  const likes = new Map<string, LikeRow>();
  const countReplies = (activityId: string) =>
    [...replies.values()].filter((r) => r.activityId === activityId && r.deletedAt === null).length;
  const countLikes = (activityId: string) =>
    [...likes.values()].filter((l) => l.activityId === activityId).length;

  const selectUser = (id: string) => {
    const u = profiles.get(id);
    return u ? { id: u.id, displayName: u.displayName, avatarUrl: u.avatarUrl } : null;
  };

  const client = {
    userProfile: {
      upsert: async ({ where, create, update }: any) => {
        const existing = [...profiles.values()].find((p) => p.googleSub === where.googleSub);
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() });
          return existing;
        }
        const now = new Date();
        const row: ProfileRow = {
          id: randomUUID(),
          googleSub: create.googleSub,
          email: create.email ?? null,
          displayName: create.displayName,
          avatarUrl: create.avatarUrl ?? null,
          createdAt: now,
          updatedAt: now,
        };
        profiles.set(row.id, row);
        return row;
      },
      findUnique: async ({ where }: any) => {
        if (where.id) return profiles.get(where.id) ?? null;
        if (where.googleSub)
          return [...profiles.values()].find((p) => p.googleSub === where.googleSub) ?? null;
        return null;
      },
    },
    activity: {
      create: async ({ data, select }: any) => {
        const row: ActivityRow = {
          id: randomUUID(),
          userId: data.userId,
          mediaType: data.mediaType,
          title: data.title,
          author: data.author ?? null,
          note: data.note ?? null,
          coverUrl: data.coverUrl ?? null,
          providerId: data.providerId ?? null,
          description: data.description ?? null,
          providerUrl: data.providerUrl ?? null,
          createdAt: new Date(),
        };
        activities.set(row.id, row);
        return select ? projectActivity(row, select, selectUser, countReplies, countLikes) : row;
      },
      findUnique: async ({ where, select }: any) => {
        const row = activities.get(where.id);
        if (!row) return null;
        return select ? projectActivity(row, select, selectUser, countReplies, countLikes) : row;
      },
      findMany: async ({ take, where, select }: any) => {
        let rows = [...activities.values()];
        if (where?.OR) {
          rows = rows.filter((r) => matchKeyset(r, where.OR));
        }
        if (where?.userId) {
          rows = rows.filter((r) => r.userId === where.userId);
        }
        rows.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1),
        );
        if (typeof take === 'number') rows = rows.slice(0, take);
        return rows.map((r) => (select ? projectActivity(r, select, selectUser, countReplies, countLikes) : r));
      },
      count: async ({ where }: any = {}) => {
        let rows = [...activities.values()];
        if (where?.userId) rows = rows.filter((r) => r.userId === where.userId);
        return rows.length;
      },
      deleteMany: async ({ where }: any) => {
        let count = 0;
        for (const [id, row] of activities) {
          if (where.id && row.id !== where.id) continue;
          if (where.userId && row.userId !== where.userId) continue;
          activities.delete(id);
          // Mirror the DB cascade: deleting an activity removes its conversation + likes.
          for (const [rid, r] of replies) if (r.activityId === id) replies.delete(rid);
          for (const [lid, l] of likes) if (l.activityId === id) likes.delete(lid);
          count++;
        }
        return { count };
      },
    },
    session: {
      create: async ({ data, select }: any) => {
        const row: SessionRow = {
          id: randomUUID(),
          userId: data.userId,
          createdAt: new Date(),
          expiresAt: data.expiresAt,
          lastSeenAt: data.lastSeenAt,
        };
        sessions.set(row.id, row);
        return select ? pick(row, select) : row;
      },
      findUnique: async ({ where, select }: any) => {
        const row = sessions.get(where.id);
        if (!row) return null;
        return select ? pick(row, select) : row;
      },
      update: async ({ where, data }: any) => {
        const row = sessions.get(where.id);
        if (row) Object.assign(row, data);
        return row;
      },
      deleteMany: async ({ where }: any) => {
        let count = 0;
        for (const [id, row] of sessions) {
          if (where.id && row.id !== where.id) continue;
          if (where.userId && row.userId !== where.userId) continue;
          sessions.delete(id);
          count++;
        }
        return { count };
      },
    },
    recommendation: {
      upsert: async ({ where, create, update, select }: any) => {
        const key = where.uq_recommendation_user_item;
        const existing = [...recommendations.values()].find(
          (r) =>
            r.userId === key.userId &&
            r.mediaType === key.mediaType &&
            r.providerId === key.providerId,
        );
        if (existing) {
          Object.assign(existing, update);
          return select ? projectRecommendation(existing, select, selectUser) : existing;
        }
        const row: RecommendationRow = {
          id: randomUUID(),
          userId: create.userId,
          mediaType: create.mediaType,
          title: create.title,
          creator: create.creator ?? null,
          coverUrl: create.coverUrl ?? null,
          providerId: create.providerId,
          createdAt: new Date(),
        };
        recommendations.set(row.id, row);
        return select ? projectRecommendation(row, select, selectUser) : row;
      },
      findMany: async ({ take, select }: any = {}) => {
        let rows = [...recommendations.values()];
        rows.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1),
        );
        if (typeof take === 'number') rows = rows.slice(0, take);
        return rows.map((r) => (select ? projectRecommendation(r, select, selectUser) : r));
      },
      deleteMany: async ({ where }: any) => {
        let count = 0;
        for (const [id, row] of recommendations) {
          if (where.id && row.id !== where.id) continue;
          if (where.userId && row.userId !== where.userId) continue;
          recommendations.delete(id);
          count++;
        }
        return { count };
      },
    },
    libraryItem: {
      upsert: async ({ where, create, update, select }: any) => {
        const key = where.uq_library_user_item;
        const existing = [...library.values()].find(
          (r) =>
            r.userId === key.userId &&
            r.mediaType === key.mediaType &&
            r.providerId === key.providerId,
        );
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() });
          return select ? projectLibrary(existing, select) : existing;
        }
        const row: LibraryRow = {
          id: randomUUID(),
          userId: create.userId,
          mediaType: create.mediaType,
          title: create.title,
          creator: create.creator ?? null,
          coverUrl: create.coverUrl ?? null,
          providerId: create.providerId,
          description: create.description ?? null,
          providerUrl: create.providerUrl ?? null,
          shelf: create.shelf ?? 'want',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        library.set(row.id, row);
        return select ? projectLibrary(row, select) : row;
      },
      findUnique: async ({ where, select }: any) => {
        const row = library.get(where.id);
        if (!row) return null;
        return select ? projectLibrary(row, select) : row;
      },
      findMany: async ({ where, select }: any = {}) => {
        let rows = [...library.values()];
        if (where?.userId) rows = rows.filter((r) => r.userId === where.userId);
        if (where?.mediaType) rows = rows.filter((r) => r.mediaType === where.mediaType);
        if (where?.shelf) rows = rows.filter((r) => r.shelf === where.shelf);
        rows.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1),
        );
        return rows.map((r) => (select ? projectLibrary(r, select) : r));
      },
      count: async ({ where }: any = {}) => {
        let rows = [...library.values()];
        if (where?.userId) rows = rows.filter((r) => r.userId === where.userId);
        if (where?.shelf) rows = rows.filter((r) => r.shelf === where.shelf);
        return rows.length;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const row of library.values()) {
          if (where.id && row.id !== where.id) continue;
          if (where.userId && row.userId !== where.userId) continue;
          Object.assign(row, data, { updatedAt: new Date() });
          count++;
        }
        return { count };
      },
      deleteMany: async ({ where }: any) => {
        let count = 0;
        for (const [id, row] of library) {
          if (where.id && row.id !== where.id) continue;
          if (where.userId && row.userId !== where.userId) continue;
          library.delete(id);
          count++;
        }
        return { count };
      },
    },
    rating: {
      upsert: async ({ where, create, update, select }: any) => {
        const key = where.uq_rating_user_item;
        const existing = [...ratings.values()].find(
          (r) => r.userId === key.userId && r.mediaType === key.mediaType && r.providerId === key.providerId,
        );
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() });
          return select ? pick(existing as any, select) : existing;
        }
        const now = new Date();
        const row: RatingRow = {
          id: randomUUID(),
          userId: create.userId,
          mediaType: create.mediaType,
          providerId: create.providerId,
          stars: create.stars,
          title: create.title,
          creator: create.creator ?? null,
          coverUrl: create.coverUrl ?? null,
          createdAt: now,
          updatedAt: now,
        };
        ratings.set(row.id, row);
        return select ? pick(row as any, select) : row;
      },
      findMany: async ({ where, select }: any = {}) => {
        let rows = [...ratings.values()];
        if (where?.userId) rows = rows.filter((r) => r.userId === where.userId);
        return rows.map((r) => (select ? pick(r as any, select) : r));
      },
      deleteMany: async ({ where }: any) => {
        let count = 0;
        for (const [id, row] of ratings) {
          if (where.userId && row.userId !== where.userId) continue;
          if (where.mediaType && row.mediaType !== where.mediaType) continue;
          if (where.providerId && row.providerId !== where.providerId) continue;
          ratings.delete(id);
          count++;
        }
        return { count };
      },
    },
    activityLike: {
      upsert: async ({ where, create }: any) => {
        const key = where.uq_like_user_activity;
        const existing = [...likes.values()].find(
          (l) => l.userId === key.userId && l.activityId === key.activityId,
        );
        if (existing) return existing;
        const row: LikeRow = {
          id: randomUUID(),
          userId: create.userId,
          activityId: create.activityId,
          createdAt: new Date(),
        };
        likes.set(row.id, row);
        return row;
      },
      findMany: async ({ where, select }: any = {}) => {
        let rows = [...likes.values()];
        if (where?.userId) rows = rows.filter((l) => l.userId === where.userId);
        if (where?.activityId?.in) rows = rows.filter((l) => where.activityId.in.includes(l.activityId));
        else if (where?.activityId) rows = rows.filter((l) => l.activityId === where.activityId);
        return rows.map((l) => (select ? pick(l as any, select) : l));
      },
      deleteMany: async ({ where }: any) => {
        let count = 0;
        for (const [id, row] of likes) {
          if (where.userId && row.userId !== where.userId) continue;
          if (where.activityId && row.activityId !== where.activityId) continue;
          likes.delete(id);
          count++;
        }
        return { count };
      },
    },
    reply: {
      create: async ({ data, select }: any) => {
        const row: ReplyRow = {
          id: randomUUID(),
          activityId: data.activityId,
          userId: data.userId,
          parentId: data.parentId ?? null,
          body: data.body,
          createdAt: new Date(),
          deletedAt: null,
        };
        replies.set(row.id, row);
        return select ? projectReply(row, select, selectUser) : row;
      },
      findUnique: async ({ where, select }: any) => {
        const row = replies.get(where.id);
        if (!row) return null;
        return select ? projectReply(row, select, selectUser) : row;
      },
      findMany: async ({ where, select }: any = {}) => {
        let rows = [...replies.values()];
        if (where?.activityId) rows = rows.filter((r) => r.activityId === where.activityId);
        if (where?.parentId !== undefined) rows = rows.filter((r) => r.parentId === where.parentId);
        rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : 1));
        return rows.map((r) => (select ? projectReply(r, select, selectUser) : r));
      },
      count: async ({ where }: any = {}) => {
        let rows = [...replies.values()];
        if (where?.parentId !== undefined) rows = rows.filter((r) => r.parentId === where.parentId);
        if (where?.activityId) rows = rows.filter((r) => r.activityId === where.activityId);
        return rows.length;
      },
      update: async ({ where, data }: any) => {
        const row = replies.get(where.id);
        if (row) Object.assign(row, data);
        return row;
      },
      deleteMany: async ({ where }: any) => {
        let count = 0;
        for (const [id, row] of replies) {
          if (where.id && row.id !== where.id) continue;
          if (where.userId && row.userId !== where.userId) continue;
          replies.delete(id);
          count++;
        }
        return { count };
      },
    },
    // Interactive transactions run against the same in-memory client (no real
    // isolation needed for these tests); array form resolves all promises.
    $transaction: async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(client)),
    $disconnect: async () => undefined,
  } as unknown as PrismaClient;

  return {
    client,
    seedProfile(partial = {}) {
      const now = new Date();
      const row: ProfileRow = {
        id: partial.id ?? randomUUID(),
        googleSub: partial.googleSub ?? `sub-${randomUUID()}`,
        email: partial.email ?? 'user@example.com',
        displayName: partial.displayName ?? 'Seed User',
        avatarUrl: partial.avatarUrl ?? null,
        createdAt: partial.createdAt ?? now,
        updatedAt: partial.updatedAt ?? now,
      };
      profiles.set(row.id, row);
      return row;
    },
    seedActivity(userId, partial = {}) {
      const row: ActivityRow = {
        id: partial.id ?? randomUUID(),
        userId,
        mediaType: partial.mediaType ?? 'book',
        title: partial.title ?? 'Seed Title',
        author: partial.author ?? null,
        note: partial.note ?? null,
        coverUrl: partial.coverUrl ?? null,
        providerId: partial.providerId ?? null,
        description: partial.description ?? null,
        providerUrl: partial.providerUrl ?? null,
        createdAt: partial.createdAt ?? new Date(),
      };
      activities.set(row.id, row);
      return row;
    },
    seedReply(activityId, userId, partial = {}) {
      const row: ReplyRow = {
        id: partial.id ?? randomUUID(),
        activityId,
        userId,
        parentId: partial.parentId ?? null,
        body: partial.body ?? 'Seed reply',
        createdAt: partial.createdAt ?? new Date(),
        deletedAt: partial.deletedAt ?? null,
      };
      replies.set(row.id, row);
      return row;
    },
    seedSession(userId, partial = {}) {
      const now = new Date();
      const row: SessionRow = {
        id: partial.id ?? randomUUID(),
        userId,
        createdAt: partial.createdAt ?? now,
        expiresAt: partial.expiresAt ?? new Date(now.getTime() + 3600_000),
        lastSeenAt: partial.lastSeenAt ?? now,
      };
      sessions.set(row.id, row);
      return row;
    },
    seedRecommendation(userId, partial = {}) {
      const row: RecommendationRow = {
        id: partial.id ?? randomUUID(),
        userId,
        mediaType: partial.mediaType ?? 'book',
        title: partial.title ?? 'Seed Rec',
        creator: partial.creator ?? null,
        coverUrl: partial.coverUrl ?? null,
        providerId: partial.providerId ?? `prov-${randomUUID()}`,
        createdAt: partial.createdAt ?? new Date(),
      };
      recommendations.set(row.id, row);
      return row;
    },
    seedLibraryItem(userId, partial = {}) {
      const now = new Date();
      const row: LibraryRow = {
        id: partial.id ?? randomUUID(),
        userId,
        mediaType: partial.mediaType ?? 'book',
        title: partial.title ?? 'Seed Item',
        creator: partial.creator ?? null,
        coverUrl: partial.coverUrl ?? null,
        providerId: partial.providerId ?? `prov-${randomUUID()}`,
        description: partial.description ?? null,
        providerUrl: partial.providerUrl ?? null,
        shelf: partial.shelf ?? 'want',
        createdAt: partial.createdAt ?? now,
        updatedAt: partial.updatedAt ?? now,
      };
      library.set(row.id, row);
      return row;
    },
  };
}

function matchKeyset(r: ActivityRow, or: any[]): boolean {
  return or.some((cond) => {
    if (cond.createdAt?.lt) return r.createdAt < new Date(cond.createdAt.lt);
    if (cond.createdAt instanceof Date || typeof cond.createdAt === 'string') {
      const eq = r.createdAt.getTime() === new Date(cond.createdAt).getTime();
      return eq && cond.id?.lt && r.id < cond.id.lt;
    }
    return false;
  });
}

function projectActivity(
  row: ActivityRow,
  select: any,
  selectUser: (id: string) => unknown,
  countReplies: (activityId: string) => number,
  countLikes: (activityId: string) => number,
): unknown {
  const out: Record<string, unknown> = {};
  if (select.id) out.id = row.id;
  if (select.mediaType) out.mediaType = row.mediaType;
  if (select.title) out.title = row.title;
  if (select.author) out.author = row.author;
  if (select.note) out.note = row.note;
  if (select.coverUrl) out.coverUrl = row.coverUrl;
  if (select.providerId) out.providerId = row.providerId;
  if (select.description) out.description = row.description;
  if (select.providerUrl) out.providerUrl = row.providerUrl;
  if (select.createdAt) out.createdAt = row.createdAt;
  if (select.userId) out.userId = row.userId;
  if (select.user) out.user = selectUser(row.userId);
  if (select._count) out._count = { replies: countReplies(row.id), likes: countLikes(row.id) };
  return out;
}

function projectReply(
  row: ReplyRow,
  select: any,
  selectUser: (id: string) => unknown,
): unknown {
  const out: Record<string, unknown> = {};
  if (select.id) out.id = row.id;
  if (select.activityId) out.activityId = row.activityId;
  if (select.userId) out.userId = row.userId;
  if (select.parentId) out.parentId = row.parentId;
  if (select.body) out.body = row.body;
  if (select.createdAt) out.createdAt = row.createdAt;
  if (select.deletedAt) out.deletedAt = row.deletedAt;
  if (select.user) out.user = selectUser(row.userId);
  return out;
}

function projectRecommendation(
  row: RecommendationRow,
  select: any,
  selectUser: (id: string) => unknown,
): unknown {
  const out: Record<string, unknown> = {};
  if (select.id) out.id = row.id;
  if (select.userId) out.userId = row.userId;
  if (select.mediaType) out.mediaType = row.mediaType;
  if (select.title) out.title = row.title;
  if (select.creator) out.creator = row.creator;
  if (select.coverUrl) out.coverUrl = row.coverUrl;
  if (select.providerId) out.providerId = row.providerId;
  if (select.createdAt) out.createdAt = row.createdAt;
  if (select.user) out.user = selectUser(row.userId);
  return out;
}

function projectLibrary(row: LibraryRow, select: any): unknown {
  const out: Record<string, unknown> = {};
  if (select.id) out.id = row.id;
  if (select.userId) out.userId = row.userId;
  if (select.mediaType) out.mediaType = row.mediaType;
  if (select.title) out.title = row.title;
  if (select.creator) out.creator = row.creator;
  if (select.coverUrl) out.coverUrl = row.coverUrl;
  if (select.providerId) out.providerId = row.providerId;
  if (select.description) out.description = row.description;
  if (select.providerUrl) out.providerUrl = row.providerUrl;
  if (select.shelf) out.shelf = row.shelf;
  if (select.createdAt) out.createdAt = row.createdAt;
  if (select.updatedAt) out.updatedAt = row.updatedAt;
  return out;
}

function pick<T extends Record<string, unknown>>(row: T, select: Record<string, boolean>): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(select)) {
    if (select[key]) (out as Record<string, unknown>)[key] = row[key];
  }
  return out;
}
