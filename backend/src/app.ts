import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import type { PrismaClient } from '@prisma/client';
import type { ErrorDTO } from '@dml/shared';

import { loadConfig, type AppConfig } from './config/index.js';
import { buildLoggerOptions } from './plugins/logging.js';
import { getPrisma } from './models/db.js';
import { RedisCacheService, type CacheService } from './services/cache.js';
import { GoogleOidcService, type OidcService } from './services/oidc.js';
import { ProfileService } from './services/profile.js';
import { FeedService } from './services/feed.js';
import { ActivityService } from './services/activity.js';
import { HomeService } from './services/home.js';
import { TrendingService } from './services/discover.js';
import { SearchService } from './services/search.js';
import { RecommendationService } from './services/recommendations.js';
import { WishlistService } from './services/wishlist.js';
import type { ContentProvider } from './providers/content-provider.js';
import type { SearchProvider } from './providers/search-provider.js';
import { GoogleBooksSearchProvider } from './providers/google-books-search.js';
import { ItunesSearchProvider } from './providers/itunes-search.js';
import { NytBooksProvider } from './providers/nyt-books.js';
import { GoogleBooksProvider } from './providers/google-books.js';
import { CompositeBooksProvider } from './providers/composite-books.js';
import { AppleMusicProvider } from './providers/apple-music.js';
import { AppleAudiobookProvider } from './providers/apple-audiobooks.js';
import { ApplePodcastProvider } from './providers/apple-podcasts.js';
import type { MediaType } from '@dml/shared';
import { SessionManager } from './plugins/session.js';
import authPlugin from './plugins/auth.js';
import { HttpError, sendError, badRequest } from './plugins/errors.js';
import type { AppContext } from './context.js';
import { registerAuthRoutes } from './api/auth.js';
import { registerMeRoutes } from './api/me.js';
import { registerFeedRoutes } from './api/feed.js';
import { registerActivityRoutes } from './api/activities.js';
import { registerHomeRoutes } from './api/home.js';
import { registerDiscoverRoutes } from './api/discover.js';
import { registerSearchRoutes } from './api/search.js';
import { registerRecommendationRoutes } from './api/recommendations.js';
import { registerWishlistRoutes } from './api/wishlist.js';

/** Overrides let tests inject stubs (prisma/cache/oidc) and a custom config. */
export interface BuildAppOverrides {
  config?: AppConfig;
  prisma?: PrismaClient;
  cache?: CacheService;
  oidc?: OidcService;
  /** Inject fake content providers in tests (avoids real provider calls). */
  providers?: Record<MediaType, ContentProvider>;
  /** Inject fake search providers in tests (avoids real provider calls). */
  searchProviders?: Record<MediaType, SearchProvider>;
}

/**
 * Construct the Fastify app: cookie support, structured logging, plugins,
 * routes (all under /api), security headers, and a global ErrorDTO handler.
 * Exported so contract/integration tests can drive it with `app.inject()`.
 */
export async function buildApp(overrides: BuildAppOverrides = {}): Promise<FastifyInstance> {
  const config = overrides.config ?? loadConfig();

  const app = Fastify({
    logger: buildLoggerOptions(config),
    // Trust the LB/proxy so request.protocol/ip reflect the client.
    trustProxy: true,
    // Generate a request id for log correlation if upstream didn't.
    genReqId: (req) => (req.headers['x-cloud-trace-context'] as string) ?? undefined,
  });

  // Wire dependencies (real or injected stubs).
  const prisma = overrides.prisma ?? getPrisma();
  const cache = overrides.cache ?? RedisCacheService.fromUrl(config.REDIS_URL);
  const oidc = overrides.oidc ?? new GoogleOidcService(config);
  const session = new SessionManager(prisma, config);
  const profiles = new ProfileService(prisma);
  const feed = new FeedService(prisma, cache, config);
  const activities = new ActivityService(prisma, feed);
  const recommendations = new RecommendationService(prisma);
  const wishlist = new WishlistService(prisma);
  const home = new HomeService(prisma, recommendations, wishlist);
  const providers: Record<MediaType, ContentProvider> = overrides.providers ?? {
    // Books aggregate NYT (all bestseller genres) + Google Books, deduped.
    book: new CompositeBooksProvider([new NytBooksProvider(config), new GoogleBooksProvider(config)]),
    // Music, audiobooks, and podcasts all use Apple's keyless RSS marketing feeds.
    music: new AppleMusicProvider(),
    audiobook: new AppleAudiobookProvider(),
    podcast: new ApplePodcastProvider(),
  };
  const discover = new TrendingService(cache, providers, config);
  const searchProviders: Record<MediaType, SearchProvider> = overrides.searchProviders ?? {
    // Books via Google Books search; music/audiobooks/podcasts via keyless iTunes Search.
    book: new GoogleBooksSearchProvider(config),
    music: new ItunesSearchProvider('music'),
    audiobook: new ItunesSearchProvider('audiobook'),
    podcast: new ItunesSearchProvider('podcast'),
  };
  const search = new SearchService(cache, searchProviders, config);

  const ctx: AppContext = {
    config, prisma, cache, oidc, session, profiles, feed, activities, home, discover, search, recommendations, wishlist,
  };
  app.decorate('ctx', ctx);

  // Signed cookies (session id + OIDC transaction state).
  await app.register(cookie, { secret: config.SESSION_SIGNING_KEY });

  // Security headers + same-origin posture. The SPA and API share one origin
  // (research §4), so no CORS is needed; lock the response down regardless.
  app.addHook('onSend', async (_request, reply, payload) => {
    void reply.header('X-Content-Type-Options', 'nosniff');
    void reply.header('X-Frame-Options', 'DENY');
    void reply.header('Referrer-Policy', 'no-referrer');
    void reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    void reply.header('Cross-Origin-Resource-Policy', 'same-origin');
    return payload;
  });

  // Auth decorator (app.requireAuth) — needs app.ctx, so register after decorate.
  await app.register(authPlugin);

  // Global error handler → consistent ErrorDTO.
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      sendError(reply, error);
      return;
    }
    // Fastify body-parse / validation errors → 400.
    if ((error as { statusCode?: number }).statusCode === 400 || (error as { validation?: unknown }).validation) {
      const message = error instanceof Error ? error.message : 'Bad request';
      sendError(reply, badRequest(message));
      return;
    }
    request.log.error({ err: error }, 'unhandled error');
    const body: ErrorDTO = { error: 'internal_error', message: 'An unexpected error occurred' };
    void reply.code(500).send(body);
  });

  // 404 → ErrorDTO.
  app.setNotFoundHandler((_request, reply) => {
    const body: ErrorDTO = { error: 'not_found', message: 'Route not found' };
    void reply.code(404).send(body);
  });

  // All routes live under /api (single origin; LB path-routes /api/*).
  await app.register(
    async (api) => {
      await registerAuthRoutes(api);
      await registerMeRoutes(api);
      await registerFeedRoutes(api);
      await registerActivityRoutes(api);
      await registerHomeRoutes(api);
      await registerDiscoverRoutes(api);
      await registerSearchRoutes(api);
      await registerRecommendationRoutes(api);
      await registerWishlistRoutes(api);
    },
    { prefix: '/api' },
  );

  return app;
}
