import type { FastifyInstance } from 'fastify';
import {
  MEDIA_TYPES,
  type ItemDetailDTO,
  type ItemPageDTO,
  type MediaType,
} from '@dml/shared';
import { badRequest, notFound } from '../plugins/errors.js';
import type { ItemDetail } from '../providers/item-provider.js';

function toItemDetailDTO(d: ItemDetail): ItemDetailDTO {
  return {
    mediaType: d.mediaType,
    providerId: d.providerId,
    title: d.title,
    creator: d.creator,
    coverUrl: d.coverUrl,
    description: d.description,
    genres: d.genres,
    providerUrl: d.providerUrl,
    series: d.series,
  };
}

/**
 * GET /api/items/:mediaType/:providerId — authenticated item detail page payload
 * (feature 007). Provider detail and community stats are fetched concurrently;
 * a provider-detail failure degrades to `detailAvailable: false` (stats still
 * returned) rather than failing the request. 404 only when the item is unknown
 * to both the provider and our database.
 */
export async function registerItemRoutes(app: FastifyInstance): Promise<void> {
  app.get('/items/:mediaType/:providerId', { preHandler: app.requireAuth }, async (request, reply) => {
    const { mediaType: rawType, providerId } = request.params as {
      mediaType: string;
      providerId: string;
    };
    if (!(MEDIA_TYPES as readonly string[]).includes(rawType)) {
      throw badRequest(`Unknown media type: ${rawType}`);
    }
    const mediaType = rawType as MediaType;
    if (!providerId) throw badRequest('providerId is required');

    // Detail may fail (provider down / unknown id); stats come from our own DB.
    const [detailResult, stats] = await Promise.all([
      app.ctx.items
        .getItem(mediaType, providerId)
        .then((item) => ({ ok: true as const, item }))
        .catch((err: unknown) => ({ ok: false as const, err })),
      app.ctx.itemStats.getStats(mediaType, providerId),
    ]);

    const detailAvailable = detailResult.ok && detailResult.item !== null;
    const item = detailResult.ok ? detailResult.item : null;

    // Unknown to the provider (clean null) AND no local footprint → 404.
    const hasLocalFootprint =
      stats.ratingCount > 0 ||
      stats.recentActivity.length > 0 ||
      stats.shelfCounts.want + stats.shelfCounts.current + stats.shelfCounts.done + stats.shelfCounts.dnf > 0;
    if (detailResult.ok && item === null && !hasLocalFootprint) {
      throw notFound('Item not found');
    }

    request.log.info(
      {
        route: 'GET /api/items',
        mediaType,
        providerId,
        detailAvailable,
        detailError: detailResult.ok ? undefined : true,
        ratingCount: stats.ratingCount,
      },
      'item served',
    );

    const body: ItemPageDTO = {
      item: item ? toItemDetailDTO(item) : null,
      detailAvailable,
      stats,
    };
    return reply.code(200).send(body);
  });
}
