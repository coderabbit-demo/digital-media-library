import type { FastifyServerOptions } from 'fastify';
import type { AppConfig } from '../config/index.js';

/**
 * Structured JSON logging configuration for Fastify (Principle V).
 *
 * Cloud Logging ingests stdout JSON; Fastify's pino logger emits JSON by
 * default in production, so we keep the raw transport and only prettify in
 * local development for readability. Cache hit/miss is logged from the feed
 * service/route via `request.log.info({ cacheHit })`.
 */
export function buildLoggerOptions(config: AppConfig): FastifyServerOptions['logger'] {
  const base = {
    level: config.NODE_ENV === 'test' ? 'silent' : 'info',
    // Redact anything that could leak the session secret or cookie value.
    redact: {
      paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
      remove: true,
    },
    // Map Cloud Logging's expected severity field.
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
  };

  if (config.NODE_ENV === 'development') {
    return {
      ...base,
      level: 'debug',
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
      },
    };
  }

  return base;
}
