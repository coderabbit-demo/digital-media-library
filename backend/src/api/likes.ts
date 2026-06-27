import type { FastifyInstance } from 'fastify';

/** Like / unlike an activity (UI refresh). */
export async function registerLikeRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/activities/:id/like — like (idempotent); 204.
  app.post<{ Params: { id: string } }>(
    '/activities/:id/like',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      await app.ctx.likes.like(request.currentUser!.id, request.params.id);
      return reply.code(204).send();
    },
  );

  // DELETE /api/activities/:id/like — unlike (idempotent); 204.
  app.delete<{ Params: { id: string } }>(
    '/activities/:id/like',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      await app.ctx.likes.unlike(request.currentUser!.id, request.params.id);
      return reply.code(204).send();
    },
  );
}
