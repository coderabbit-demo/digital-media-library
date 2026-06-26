import type { FastifyInstance } from 'fastify';

/** GET /api/me — the authenticated user's public profile (200) or 401. */
export async function registerMeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/me', { preHandler: app.requireAuth }, async (request, reply) => {
    // requireAuth guarantees currentUser is populated.
    return reply.code(200).send(request.currentUser!);
  });
}
