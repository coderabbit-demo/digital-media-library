import type { FastifyInstance } from 'fastify';
import { mediaTypeForCategory, type DiscoverPageDTO, type TrendingItemDTO } from '@dml/shared';
import { badRequest } from '../plugins/errors.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
// Books span many genres (NYT lists + Google subjects); fetch enough to fill sections.
const BOOKS_BATCH = 96;

/**
 * GET /api/discover/{category} — authenticated trending for a media category,
 * served via the provider abstraction + cache (fresh → lazy refresh → stale → empty).
 */
export async function registerDiscoverRoutes(app: FastifyInstance): Promise<void> {
  app.get('/discover/:category', { preHandler: app.requireAuth }, async (request, reply) => {
    const { category } = request.params as { category: string };
    const mediaType = mediaTypeForCategory(category);
    if (!mediaType) throw badRequest(`Unknown category: ${category}`);

    const rawLimit = Number((request.query as { limit?: string }).limit ?? DEFAULT_LIMIT);
    if (!Number.isFinite(rawLimit) || rawLimit < 1 || rawLimit > MAX_LIMIT) {
      throw badRequest(`limit must be between 1 and ${MAX_LIMIT}`);
    }
    // Books are grouped into genre sections in the UI, so fetch a generous batch
    // to span many genres; other categories use the requested limit.
    const limit = mediaType === 'book' ? BOOKS_BATCH : Math.floor(rawLimit);

    const { items, stale, cacheHit } = await app.ctx.discover.getDiscover(mediaType, limit);

    request.log.info(
      { route: 'GET /api/discover', category: mediaType, items: items.length, stale, cacheHit },
      'discover served',
    );

    const body: DiscoverPageDTO = {
      category: mediaType,
      stale,
      items: items.map(
        (i): TrendingItemDTO => ({
          mediaType: i.mediaType,
          title: i.title,
          creator: i.creator,
          coverUrl: i.coverUrl,
          providerId: i.providerId,
          genre: i.genre,
        }),
      ),
    };
    return reply.code(200).send(body);
  });
}
