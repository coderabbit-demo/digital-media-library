import type { FastifyReply } from 'fastify';
import type { ErrorDTO } from '@dml/shared';

/**
 * A domain error carrying an HTTP status and a stable machine-readable `error`
 * code alongside a human `message`. Thrown by services/routes and translated to
 * an ErrorDTO by the global error handler.
 */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const unauthorized = (message = 'Authentication required') =>
  new HttpError(401, 'unauthorized', message);
export const forbidden = (message = 'You do not have access to this resource') =>
  new HttpError(403, 'forbidden', message);
export const notFound = (message = 'Resource not found') =>
  new HttpError(404, 'not_found', message);
export const badRequest = (message = 'Invalid request') =>
  new HttpError(400, 'bad_request', message);
export const rateLimited = (message = 'Rate limit exceeded') =>
  new HttpError(429, 'rate_limited', message);

/** Send a consistent ErrorDTO body. */
export function sendError(reply: FastifyReply, err: HttpError): void {
  const body: ErrorDTO = { error: err.code, message: err.message };
  void reply.code(err.statusCode).send(body);
}
