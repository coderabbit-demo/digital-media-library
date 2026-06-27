import type { FastifyInstance } from 'fastify';
import {
  createLibraryItemSchema,
  mediaTypeSchema,
  shelfSchema,
  updateLibraryItemSchema,
  type LibraryPageDTO,
} from '@dml/shared';
import { badRequest, notFound } from '../plugins/errors.js';

/**
 * "My Library" routes — private, owner-scoped. Items live on one shelf each
 * (Goodreads-style); "All" is the unfiltered list.
 */
export async function registerLibraryRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/library?shelf=&mediaType= — the current user's library (optional filters).
  app.get('/library', { preHandler: app.requireAuth }, async (request, reply) => {
    const { shelf: rawShelf, mediaType: rawMedia } = request.query as {
      shelf?: string;
      mediaType?: string;
    };
    let shelf;
    if (rawShelf !== undefined) {
      const parsed = shelfSchema.safeParse(rawShelf);
      if (!parsed.success) throw badRequest(`Unknown shelf: ${rawShelf}`);
      shelf = parsed.data;
    }
    let mediaType;
    if (rawMedia !== undefined) {
      const parsed = mediaTypeSchema.safeParse(rawMedia);
      if (!parsed.success) throw badRequest(`Unknown mediaType: ${rawMedia}`);
      mediaType = parsed.data;
    }
    const items = await app.ctx.library.list(request.currentUser!.id, { shelf, mediaType });
    const body: LibraryPageDTO = { items };
    return reply.code(200).send(body);
  });

  // POST /api/library — add an item (idempotent; defaults to the Want shelf).
  app.post('/library', { preHandler: app.requireAuth }, async (request, reply) => {
    const parsed = createLibraryItemSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((i) => i.message).join('; '));
    }
    const created = await app.ctx.library.add(request.currentUser!.id, parsed.data);
    return reply.code(201).send(created);
  });

  // PATCH /api/library/:id — move an item to a different shelf.
  app.patch<{ Params: { id: string } }>(
    '/library/:id',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const parsed = updateLibraryItemSchema.safeParse(request.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.issues.map((i) => i.message).join('; '));
      }
      const moved = await app.ctx.library.move(request.currentUser!.id, request.params.id, parsed.data.shelf);
      if (!moved) throw notFound('Library item not found');
      return reply.code(200).send(moved);
    },
  );

  // DELETE /api/library/:id — remove from the library; 204 (idempotent).
  app.delete<{ Params: { id: string } }>(
    '/library/:id',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      await app.ctx.library.remove(request.currentUser!.id, request.params.id);
      return reply.code(204).send();
    },
  );
}
