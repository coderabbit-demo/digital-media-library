import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright e2e smoke config. Starts the Vite dev server (which proxies /api
 * to the backend). The smoke test stubs the Google OAuth step so it does not
 * depend on real Google — see tests/e2e/feed.spec.ts.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
