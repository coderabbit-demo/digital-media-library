import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { toProfileDTO } from '../services/profile.js';
import { unauthorized } from './errors.js';

/**
 * Registers `app.requireAuth`, a preHandler that loads the current UserProfile
 * from the session cookie and attaches it to `request.currentUser`. Routes that
 * require a signed-in user list it in their preHandler chain. On a
 * missing/expired session it throws a 401 (translated to ErrorDTO by the global
 * error handler).
 */
async function authPlugin(app: FastifyInstance): Promise<void> {
  app.decorateRequest('currentUser', undefined);
  app.decorateRequest('currentSessionId', undefined);

  app.decorate('requireAuth', async function (request: FastifyRequest, _reply: FastifyReply) {
    const { session, profiles } = app.ctx;
    const current = await session.current(request);
    if (!current) throw unauthorized();

    const profile = await profiles.findById(current.userId);
    if (!profile) {
      // Session references a deleted profile — treat as unauthenticated.
      throw unauthorized();
    }

    request.currentUser = toProfileDTO(profile);
    request.currentSessionId = current.id;
  });
}

export default fp(authPlugin, { name: 'auth' });
