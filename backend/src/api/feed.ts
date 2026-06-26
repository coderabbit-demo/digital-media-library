import type { FastifyInstance } from 'fastify';
import { feedQuerySchema } from '@dml/shared';
import { badRequest } from '../plugins/errors.js';

/** GET /api/feed — authenticated, keyset-paginated global feed. */
export async function registerFeedRoutes(app: FastifyInstance): Promise<void> {
  app.get('/feed', { preHandler: app.requireAuth }, async (request, reply) => {
    const parsed = feedQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const currentUser = request.currentUser!;
    const { page, cacheHit } = await app.ctx.feed.getPage(currentUser.id, {
      cursor: parsed.data.cursor,
      limit: parsed.data.limit,
    });

    // Structured cache hit/miss log for observability (Principle V).
    request.log.info({ cacheHit, route: 'GET /api/feed', items: page.items.length }, 'feed page served');

    return reply.code(200).send(page);
  });
}
