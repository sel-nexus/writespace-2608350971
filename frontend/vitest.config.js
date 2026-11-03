/** Discover unit/component tests only; browser specs belong to Playwright. */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/testSetup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    restoreMocks: true,
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
  },
});
