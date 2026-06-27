import type { FastifyInstance } from 'fastify';

/**
 * GET /api/home — authenticated, aggregated home payload assembled from local
 * data only (no external content-provider calls). Returns the user's "currently
 * reading/listening" list (My Library `current` shelf), counts, and recent
 * community recommendations.
 */
export async function registerHomeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/home', { preHandler: app.requireAuth }, async (request, reply) => {
    const currentUser = request.currentUser!;
    const data = await app.ctx.home.getHome(currentUser.id);

    request.log.info(
      { route: 'GET /api/home', current: data.current.length, currentlyOn: data.counts.currentlyOn },
      'home served',
    );

    return reply.code(200).send(data);
  });
}
