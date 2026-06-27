import type { FastifyInstance } from 'fastify';
import {
  mediaTypeForCategory,
  SEARCH_QUERY_MAX_LENGTH,
  type SearchPageDTO,
  type TrendingItemDTO,
} from '@dml/shared';
import { badRequest } from '../plugins/errors.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** GET /api/search?category=&q=&limit= — provider-backed, cached media search. */
export async function registerSearchRoutes(app: FastifyInstance): Promise<void> {
  app.get('/search', { preHandler: app.requireAuth }, async (request, reply) => {
    const { category, q, limit: limitParam } = request.query as {
      category?: string;
      q?: string;
      limit?: string;
    };

    const mediaType = category ? mediaTypeForCategory(category) : null;
    if (!mediaType) throw badRequest(`Unknown category: ${category ?? ''}`);

    const query = (q ?? '').trim();
    if (!query) throw badRequest('q is required');
    if (query.length > SEARCH_QUERY_MAX_LENGTH) {
      throw badRequest(`q must be at most ${SEARCH_QUERY_MAX_LENGTH} characters`);
    }

    const rawLimit = Number(limitParam ?? DEFAULT_LIMIT);
    if (!Number.isFinite(rawLimit) || rawLimit < 1 || rawLimit > MAX_LIMIT) {
      throw badRequest(`limit must be between 1 and ${MAX_LIMIT}`);
    }

    const items = await app.ctx.search.search(mediaType, query, Math.floor(rawLimit));
    request.log.info(
      { route: 'GET /api/search', category: mediaType, items: items.length },
      'search served',
    );

    const body: SearchPageDTO = {
      category: mediaType,
      query,
      items: items.map(
        (i): TrendingItemDTO => ({
          mediaType: i.mediaType,
          title: i.title,
          creator: i.creator,
          coverUrl: i.coverUrl,
          providerId: i.providerId,
          genre: i.genre,
          description: i.description,
          providerUrl: i.providerUrl,
        }),
      ),
    };
    return reply.code(200).send(body);
  });
}
