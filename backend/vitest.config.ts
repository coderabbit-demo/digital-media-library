import { defineConfig } from 'vitest/config';

/**
 * Three test projects keyed by directory:
 *  - unit: pure service/validation tests (no DB, no network).
 *  - contract: request/response shape vs contracts/openapi.yaml using
 *    app.inject() with stubbed prisma/cache/oidc.
 *  - integration: real PostgreSQL via Testcontainers; OIDC stubbed.
 *
 * Run all: `vitest run`. Per suite: `vitest run --project <name>`.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'contract',
          include: ['tests/contract/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          // Containers + migrations are slow to start.
          testTimeout: 120_000,
          hookTimeout: 180_000,
        },
      },
    ],
  },
});
