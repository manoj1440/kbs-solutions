import { defineConfig, devices } from '@playwright/test';

/**
 * F-901 web e2e. Runs against an already-started web (E2E_BASE_URL) + API with the dev OTP master code.
 * Local: E2E_CHROMIUM=/opt/pw-browsers/chromium E2E_BASE_URL=http://localhost:3200 E2E_DB_URL=… pnpm --filter web test:e2e
 * Mac without host psql: E2E_PG_CONTAINER=kbs-test-pg E2E_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" (+ E2E_API_URL).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  grepInvert: /\[quarantine\]/,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    ...(process.env.E2E_CHROMIUM ? { launchOptions: { executablePath: process.env.E2E_CHROMIUM } } : {}),
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
  ],
});
