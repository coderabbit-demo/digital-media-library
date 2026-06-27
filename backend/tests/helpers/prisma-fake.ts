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
  createdAt: Date;
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

export interface FakePrisma {
  client: PrismaClient;
  seedProfile(partial?: Partial<ProfileRow>): ProfileRow;
  seedActivity(userId: string, partial?: Partial<ActivityRow>): ActivityRow;
  seedSession(userId: string, partial?: Partial<SessionRow>): SessionRow;
  seedRecommendation(userId: string, partial?: Partial<RecommendationRow>): RecommendationRow;
}

export function createFakePrisma(): FakePrisma {
  const profiles = new Map<string, ProfileRow>();
  const activities = new Map<string, ActivityRow>();
  const sessions = new Map<string, SessionRow>();
  const recommendations = new Map<string, RecommendationRow>();

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
          createdAt: new Date(),
        };
        activities.set(row.id, row);
        return select ? projectActivity(row, select, selectUser) : row;
      },
      findUnique: async ({ where, select }: any) => {
        const row = activities.get(where.id);
        if (!row) return null;
        return select ? projectActivity(row, select, selectUser) : row;
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
        return rows.map((r) => (select ? projectActivity(r, select, selectUser) : r));
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
        createdAt: partial.createdAt ?? new Date(),
      };
      activities.set(row.id, row);
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
): unknown {
  const out: Record<string, unknown> = {};
  if (select.id) out.id = row.id;
  if (select.mediaType) out.mediaType = row.mediaType;
  if (select.title) out.title = row.title;
  if (select.author) out.author = row.author;
  if (select.createdAt) out.createdAt = row.createdAt;
  if (select.userId) out.userId = row.userId;
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

function pick<T extends Record<string, unknown>>(row: T, select: Record<string, boolean>): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(select)) {
    if (select[key]) (out as Record<string, unknown>)[key] = row[key];
  }
  return out;
}
