import type { FastifyInstance } from 'fastify';
import { mediaTypeSchema, upsertRatingSchema, type RatingDTO } from '@dml/shared';
import { badRequest } from '../plugins/errors.js';

/** GET/PUT/DELETE /api/ratings — per-user star ratings (UI refresh). */
export async function registerRatingRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/ratings — the current user's ratings (for "your rating" display).
  app.get('/ratings', { preHandler: app.requireAuth }, async (request, reply) => {
    const ratings: RatingDTO[] = await app.ctx.ratings.listForUser(request.currentUser!.id);
    return reply.code(200).send({ ratings });
  });

  // PUT /api/ratings — set/update a rating (idempotent upsert per user+item).
  app.put('/ratings', { preHandler: app.requireAuth }, async (request, reply) => {
    const parsed = upsertRatingSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((i) => i.message).join('; '));
    }
    const rating = await app.ctx.ratings.upsert(request.currentUser!.id, parsed.data);
    return reply.code(200).send(rating);
  });

  // DELETE /api/ratings?mediaType=&providerId= — clear the user's rating.
  app.delete('/ratings', { preHandler: app.requireAuth }, async (request, reply) => {
    const { mediaType: rawMedia, providerId } = request.query as {
      mediaType?: string;
      providerId?: string;
    };
    const media = mediaTypeSchema.safeParse(rawMedia);
    if (!media.success) throw badRequest('Valid mediaType is required');
    if (!providerId) throw badRequest('providerId is required');
    await app.ctx.ratings.remove(request.currentUser!.id, media.data, providerId);
    return reply.code(204).send();
  });
}
