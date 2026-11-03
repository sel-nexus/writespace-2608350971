/** Launch environment-driven Vite and exercise discovery on desktop and mobile. */
import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';

const env = loadEnv('development', process.cwd(), '');
const baseURL = env.E2E_BASE_URL;
const port = Number(env.PORT);
if (!baseURL || !env.HOST || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Configure PORT, HOST and E2E_BASE_URL using .env.example before browser tests.');
}
const origin = new URL(baseURL);
if (!['http:', 'https:'].includes(origin.protocol)) throw new Error('E2E_BASE_URL must be an HTTP(S) origin.');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js',
    url: baseURL,
    env: { PORT: env.PORT, HOST: env.HOST },
    reuseExistingServer: false,
    timeout: 30000,
  },
});
