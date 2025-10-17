import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E tests
 *
 * Tests run against the development server at http://localhost:3001
 * Uses Chromium browser for testing
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run dev server before starting tests (commented out - we'll start it manually)
  // webServer: {
  //   command: 'pnpm dev',
  //   url: 'http://localhost:3001',
  //   reuseExistingServer: !process.env.CI,
  // },
});
