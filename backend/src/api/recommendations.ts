import type { FastifyInstance } from 'fastify';
import { createRecommendationSchema } from '@dml/shared';
import { badRequest } from '../plugins/errors.js';

/** POST /api/recommendations and DELETE /api/recommendations/:id. */
export async function registerRecommendationRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/recommendations — record the user's recommendation (idempotent).
  app.post('/recommendations', { preHandler: app.requireAuth }, async (request, reply) => {
    const parsed = createRecommendationSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((i) => i.message).join('; '));
    }
    const currentUser = request.currentUser!;
    const created = await app.ctx.recommendations.create(currentUser.id, parsed.data);
    return reply.code(201).send(created);
  });

  // DELETE /api/recommendations/:id — remove one the user made; 204 (idempotent).
  app.delete<{ Params: { id: string } }>(
    '/recommendations/:id',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const currentUser = request.currentUser!;
      await app.ctx.recommendations.remove(currentUser.id, request.params.id);
      return reply.code(204).send();
    },
  );
}
