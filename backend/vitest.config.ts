import { defineConfig } from 'vitest/config';

/**
 * Test suites live under tests/{unit,contract,integration}. Run all with
 * `vitest run`, or a single suite by path, e.g. `vitest run tests/unit`
 * (see the package.json test:* scripts). Integration uses Testcontainers
 * PostgreSQL and needs Docker; unit/contract are offline.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Containers + migrations are slow to start (applies to integration).
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
});
