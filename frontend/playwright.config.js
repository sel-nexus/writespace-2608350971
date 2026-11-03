/** Launch environment-driven Vite and exercise discovery on desktop and mobile. */
import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Read the small local config directly; do not transform Vite's build tool in the test runner.
const defaults = Object.fromEntries(readFileSync('.env', 'utf8').split('\n')
  .filter((line) => line.trim() && !line.trim().startsWith('#'))
  .map((line) => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).trim()]; }));
const env = { ...defaults, ...process.env };
const baseURL = env.E2E_BASE_URL;
const port = Number(env.PORT);
if (!baseURL || !env.HOST || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Configure PORT, HOST and E2E_BASE_URL using .env.example before browser tests.');
}
const origin = new URL(baseURL);
if (!['http:', 'https:'].includes(origin.protocol)) throw new Error('E2E_BASE_URL must be an HTTP(S) origin.');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: `node node_modules/vite/bin/vite.js preview --host ${env.HOST} --port ${port}`,
    url: baseURL,
    env: { PORT: env.PORT, HOST: env.HOST },
    reuseExistingServer: true,
    timeout: 30000,
  },
});
