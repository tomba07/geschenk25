import { defineConfig, devices } from '@playwright/test';

const webPort = process.env.PLAYWRIGHT_WEB_PORT || '5178';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${webPort}`;
const startServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER !== 'true';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: startServer
    ? {
        command: 'npm run e2e:server',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
