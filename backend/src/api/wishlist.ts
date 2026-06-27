import type { FastifyInstance } from 'fastify';
import { createWishlistItemSchema, mediaTypeSchema, type WishlistPageDTO } from '@dml/shared';
import { badRequest } from '../plugins/errors.js';

/** GET/POST /api/wishlist and DELETE /api/wishlist/:id — private, owner-scoped. */
export async function registerWishlistRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/wishlist?mediaType= — the current user's wishlist (optional filter).
  app.get('/wishlist', { preHandler: app.requireAuth }, async (request, reply) => {
    const { mediaType: raw } = request.query as { mediaType?: string };
    let mediaType;
    if (raw !== undefined) {
      const parsed = mediaTypeSchema.safeParse(raw);
      if (!parsed.success) throw badRequest(`Unknown mediaType: ${raw}`);
      mediaType = parsed.data;
    }
    const items = await app.ctx.wishlist.list(request.currentUser!.id, mediaType);
    const body: WishlistPageDTO = { items };
    return reply.code(200).send(body);
  });

  // POST /api/wishlist — add an item (idempotent).
  app.post('/wishlist', { preHandler: app.requireAuth }, async (request, reply) => {
    const parsed = createWishlistItemSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((i) => i.message).join('; '));
    }
    const created = await app.ctx.wishlist.add(request.currentUser!.id, parsed.data);
    return reply.code(201).send(created);
  });

  // DELETE /api/wishlist/:id — remove one the user owns; 204 (idempotent).
  app.delete<{ Params: { id: string } }>(
    '/wishlist/:id',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      await app.ctx.wishlist.remove(request.currentUser!.id, request.params.id);
      return reply.code(204).send();
    },
  );
}
