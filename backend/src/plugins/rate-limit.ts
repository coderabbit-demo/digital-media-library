import type { FastifyRequest, FastifyReply } from 'fastify';
import type { CacheService } from '../services/cache.js';
import { rateLimited, unauthorized } from './errors.js';

const WINDOW_SECONDS = 60;

/**
 * Per-user rate limiter (FR-019): at most N actions per rolling 60s window,
 * enforced via Redis counters so the limit holds across stateless Cloud Run
 * instances (research §7). Must run AFTER requireAuth so `currentUser` is set.
 *
 * `bucket` namespaces the counter so different actions (e.g. posts vs. replies)
 * get independent budgets; `noun` is used in the error message. Returns a
 * preHandler bound to the cache + limit.
 */
export function makePostRateLimiter(
  cache: CacheService,
  limitPerMinute: number,
  bucket = 'posts',
  noun = 'posts',
) {
  return async function rateLimitPreHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.currentUser?.id;
    if (!userId) {
      // Defensive: limiter should always follow requireAuth.
      throw unauthorized();
    }

    // Bucket by the current minute so the window resets cleanly.
    const minuteBucket = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
    const key = `ratelimit:${bucket}:${userId}:${minuteBucket}`;
    const count = await cache.incrWithExpiry(key, WINDOW_SECONDS);

    if (count > limitPerMinute) {
      // Advise the client when to retry (seconds until this bucket rolls over).
      const retryAfter = WINDOW_SECONDS - (Math.floor(Date.now() / 1000) % WINDOW_SECONDS);
      void reply.header('Retry-After', String(retryAfter));
      throw rateLimited(
        `Rate limit exceeded: at most ${limitPerMinute} ${noun} per minute. Try again in ${retryAfter}s.`,
      );
    }
  };
}
