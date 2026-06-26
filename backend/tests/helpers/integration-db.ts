import { execFileSync } from 'node:child_process';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';

/**
 * Spin up a throwaway PostgreSQL via Testcontainers, apply the Prisma schema
 * with `prisma db push` (no committed migration files exist yet — see
 * prisma/schema.prisma NOTE), and return a connected client.
 *
 * Requires Docker to be running. Integration tests skip gracefully if the
 * container cannot start in the current environment.
 */
export interface IntegrationDb {
  container: StartedPostgreSqlContainer;
  prisma: PrismaClient;
  databaseUrl: string;
  stop(): Promise<void>;
}

export async function startIntegrationDb(): Promise<IntegrationDb> {
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('dml')
    .withUsername('dml')
    .withPassword('dml')
    .start();

  const databaseUrl = container.getConnectionUri();

  // Apply schema to the fresh DB. db push avoids needing migration files.
  execFileSync('pnpm', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
    cwd: new URL('../../', import.meta.url).pathname,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await prisma.$connect();

  return {
    container,
    prisma,
    databaseUrl,
    async stop() {
      await prisma.$disconnect();
      await container.stop();
    },
  };
}

/** Truncate all tables between tests for isolation. */
export async function resetDb(prisma: PrismaClient): Promise<void> {
  // CASCADE handles FK order; restart identity is unnecessary for UUID PKs.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session", "activity", "user_profile" CASCADE');
}
