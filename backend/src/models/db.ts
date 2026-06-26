import { PrismaClient } from '@prisma/client';

/**
 * PrismaClient singleton.
 *
 * Cloud Run runs many short-lived instances, each of which opens its own pool.
 * Keep the per-instance pool small to avoid exhausting CloudSQL's connection
 * limit when the service scales out (Principle V). Tune the pool via the
 * `connection_limit` query parameter on DATABASE_URL, e.g.
 *   postgresql://.../dml?connection_limit=5
 * A single shared instance is reused across requests within a process.
 */
let prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

/** Allows tests to inject a client (e.g. pointed at a Testcontainers DB). */
export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export type { PrismaClient };
