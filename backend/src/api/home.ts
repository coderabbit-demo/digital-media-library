import type { FastifyInstance } from 'fastify';

/**
 * GET /api/home — authenticated, aggregated home payload assembled from local
 * data only (no external content-provider calls). Returns the current user's own
 * recent items, counts, and an empty recommendations list.
 */
export async function registerHomeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/home', { preHandler: app.requireAuth }, async (request, reply) => {
    const currentUser = request.currentUser!;
    const data = await app.ctx.home.getHome(currentUser.id);

    request.log.info(
      { route: 'GET /api/home', ownItems: data.ownItems.length, currentlyOn: data.counts.currentlyOn },
      'home served',
    );

    return reply.code(200).send(data);
  });
}
