import type { FastifyInstance } from 'fastify';
import { createActivitySchema } from '@dml/shared';
import { badRequest } from '../plugins/errors.js';
import { makePostRateLimiter } from '../plugins/rate-limit.js';

/** POST /api/activities and DELETE /api/activities/:id. */
export async function registerActivityRoutes(app: FastifyInstance): Promise<void> {
  const { cache, config, activities } = app.ctx;
  const rateLimit = makePostRateLimiter(cache, config.RATE_LIMIT_POSTS_PER_MINUTE);

  // POST /api/activities — create an update (auth + rate limit + validate).
  // requireAuth runs first so the rate limiter can key on the user.
  app.post('/activities', { preHandler: [app.requireAuth, rateLimit] }, async (request, reply) => {
    const parsed = createActivitySchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const currentUser = request.currentUser!;
    const created = await activities.create(currentUser.id, parsed.data);
    return reply.code(201).send(created);
  });

  // DELETE /api/activities/:id — owner-only delete; 204 / 403 / 404.
  app.delete<{ Params: { id: string } }>(
    '/activities/:id',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const currentUser = request.currentUser!;
      await activities.delete(currentUser.id, request.params.id);
      return reply.code(204).send();
    },
  );
}
