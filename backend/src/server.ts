import { buildApp } from './app.js';
import { loadConfig } from './config/index.js';

/** Process entrypoint: build the app and listen on PORT (Cloud Run injects it). */
async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp({ config });

  // Bind 0.0.0.0 so Cloud Run's proxy can reach the container.
  await app.listen({ port: config.PORT, host: '0.0.0.0' });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down');
    try {
      await app.close();
      await app.ctx.cache.close();
      await app.ctx.prisma.$disconnect();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
