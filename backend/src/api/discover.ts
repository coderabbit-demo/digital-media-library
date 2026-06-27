import type { FastifyInstance } from 'fastify';
import { mediaTypeForCategory, type DiscoverPageDTO, type MediaType, type TrendingItemDTO } from '@dml/shared';
import { badRequest } from '../plugins/errors.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
// Genre-sectioned categories fetch a generous batch so the UI can fill many
// sections: books (NYT lists + Google subjects), music & podcasts (Apple genres).
const SECTION_BATCH: Partial<Record<MediaType, number>> = {
  book: 96,
  music: 50,
  podcast: 50,
};

/**
 * GET /api/discover/{category} — authenticated trending for a media category,
 * served via the provider abstraction + cache (fresh → lazy refresh → stale → empty).
 */
export async function registerDiscoverRoutes(app: FastifyInstance): Promise<void> {
  app.get('/discover/:category', { preHandler: app.requireAuth }, async (request, reply) => {
    const { category } = request.params as { category: string };
    const mediaType = mediaTypeForCategory(category);
    if (!mediaType) throw badRequest(`Unknown category: ${category}`);

    const rawParam = (request.query as { limit?: string }).limit;
    const rawLimit = Number(rawParam ?? DEFAULT_LIMIT);
    if (!Number.isFinite(rawLimit) || rawLimit < 1 || rawLimit > MAX_LIMIT) {
      throw badRequest(`limit must be between 1 and ${MAX_LIMIT}`);
    }
    const requestedLimit = Math.floor(rawLimit);
    // When the caller specifies a limit we honor it exactly. Otherwise, genre-
    // sectioned categories default to a generous batch so the UI can fill many
    // sections (books: NYT lists + Google subjects; music/podcasts: Apple genres).
    const effectiveLimit =
      rawParam !== undefined ? requestedLimit : (SECTION_BATCH[mediaType] ?? requestedLimit);

    const { items, stale, cacheHit } = await app.ctx.discover.getDiscover(mediaType, effectiveLimit);

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
          description: i.description,
          providerUrl: i.providerUrl,
        }),
      ),
    };
    return reply.code(200).send(body);
  });
}
