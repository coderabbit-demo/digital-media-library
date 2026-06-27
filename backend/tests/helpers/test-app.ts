import { Signer } from '@fastify/cookie';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import type { AppConfig } from '../../src/config/index.js';
import { InMemoryCacheService, type CacheService } from '../../src/services/cache.js';
import { SESSION_COOKIE_NAME } from '../../src/plugins/session.js';
import { StubOidcService } from './oidc-stub.js';
import type { PrismaClient } from '@prisma/client';

export const TEST_SIGNING_KEY = 'test-signing-key-at-least-16-chars-long';

/** A complete, deterministic test config (no real env required). */
export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    NODE_ENV: 'test',
    PORT: 0,
    APP_BASE_URL: 'http://localhost:5173',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-client-secret',
    OAUTH_REDIRECT_URI: 'http://localhost:8080/api/auth/google/callback',
    SESSION_SIGNING_KEY: TEST_SIGNING_KEY,
    RATE_LIMIT_POSTS_PER_MINUTE: 10,
    SESSION_TTL_SECONDS: 3600,
    FEED_CACHE_TTL_SECONDS: 15,
    ...overrides,
  };
}

export interface TestApp {
  app: FastifyInstance;
  cache: CacheService;
  oidc: StubOidcService;
  /** Build a signed `dml_session=<id>` cookie header value. */
  sessionCookie(sessionId: string): string;
}

/** Build the app wired with injected stubs for contract tests. */
export async function buildTestApp(opts: {
  prisma: PrismaClient;
  cache?: CacheService;
  oidc?: StubOidcService;
  config?: AppConfig;
  providers?: Parameters<typeof buildApp>[0]['providers'];
  searchProviders?: Parameters<typeof buildApp>[0]['searchProviders'];
}): Promise<TestApp> {
  const config = opts.config ?? testConfig();
  const cache = opts.cache ?? new InMemoryCacheService();
  const oidc = opts.oidc ?? new StubOidcService();

  const app = await buildApp({
    config,
    prisma: opts.prisma,
    cache,
    oidc,
    providers: opts.providers,
    searchProviders: opts.searchProviders,
  });
  await app.ready();

  const signer = new Signer(config.SESSION_SIGNING_KEY);

  return {
    app,
    cache,
    oidc,
    sessionCookie(sessionId: string) {
      const signed = signer.sign(sessionId);
      return `${SESSION_COOKIE_NAME}=${signed}`;
    },
  };
}
