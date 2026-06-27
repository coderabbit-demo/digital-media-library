import type { FastifyInstance } from 'fastify';
import { createReplySchema, RATE_LIMIT_REPLIES_PER_MINUTE, type ReplyThreadDTO } from '@dml/shared';
import { badRequest } from '../plugins/errors.js';
import { makePostRateLimiter } from '../plugins/rate-limit.js';

/**
 * Conversation routes (feature 006):
 *  - GET  /api/activities/:id/replies   — the conversation thread
 *  - POST /api/activities/:id/replies   — reply (auth + rate limit)
 *  - DELETE /api/replies/:id            — delete your own reply
 */
export async function registerReplyRoutes(app: FastifyInstance): Promise<void> {
  const { cache, replies } = app.ctx;
  const rateLimit = makePostRateLimiter(cache, RATE_LIMIT_REPLIES_PER_MINUTE, 'replies', 'replies');

  // GET conversation — visible to all authenticated users.
  app.get<{ Params: { id: string } }>(
    '/activities/:id/replies',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const thread: ReplyThreadDTO = await replies.list(request.params.id, request.currentUser!.id);
      return reply.code(200).send(thread);
    },
  );

  // POST a reply — requireAuth first so the limiter can key on the user.
  app.post<{ Params: { id: string } }>(
    '/activities/:id/replies',
    { preHandler: [app.requireAuth, rateLimit] },
    async (request, reply) => {
      const parsed = createReplySchema.safeParse(request.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.issues.map((i) => i.message).join('; '));
      }
      const created = await replies.create(request.currentUser!.id, request.params.id, parsed.data);
      return reply.code(201).send(created);
    },
  );

  // DELETE your own reply.
  app.delete<{ Params: { id: string } }>(
    '/replies/:id',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      await replies.delete(request.currentUser!.id, request.params.id);
      return reply.code(204).send();
    },
  );
}
