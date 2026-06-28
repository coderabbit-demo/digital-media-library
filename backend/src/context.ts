import type { PrismaClient } from '@prisma/client';
import type { AppConfig } from './config/index.js';
import type { CacheService } from './services/cache.js';
import type { OidcService } from './services/oidc.js';
import type { ProfileService } from './services/profile.js';
import type { FeedService } from './services/feed.js';
import type { ActivityService } from './services/activity.js';
import type { HomeService } from './services/home.js';
import type { TrendingService } from './services/discover.js';
import type { SearchService } from './services/search.js';
import type { RecommendationService } from './services/recommendations.js';
import type { LibraryService } from './services/library.js';
import type { ReplyService } from './services/reply.js';
import type { RatingService } from './services/rating.js';
import type { LikeService } from './services/like.js';
import type { ItemService } from './services/item.js';
import type { ItemStatsService } from './services/item-stats.js';
import type { SessionManager } from './plugins/session.js';
import type { ProfileDTO } from '@dml/shared';

/**
 * Wired dependencies shared across plugins and routes. Constructed in app.ts.
 * Making every collaborator injectable (especially the OIDC client) lets tests
 * stub boundaries without hitting Google or a real Redis.
 */
export interface AppContext {
  config: AppConfig;
  prisma: PrismaClient;
  cache: CacheService;
  oidc: OidcService;
  session: SessionManager;
  profiles: ProfileService;
  feed: FeedService;
  activities: ActivityService;
  home: HomeService;
  discover: TrendingService;
  search: SearchService;
  recommendations: RecommendationService;
  library: LibraryService;
  replies: ReplyService;
  ratings: RatingService;
  likes: LikeService;
  items: ItemService;
  itemStats: ItemStatsService;
}

declare module 'fastify' {
  interface FastifyInstance {
    ctx: AppContext;
    /** preHandler that 401s unless a valid session + profile is present. */
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    /** Populated by requireAuth on authenticated routes. */
    currentUser?: ProfileDTO;
    currentSessionId?: string;
  }
}
