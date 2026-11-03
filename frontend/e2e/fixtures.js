/** Fail every browser journey on console or uncaught page errors from before navigation. */
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    const consoleListener = (message) => {
      if (message.type() === 'error') errors.push(message.text());
    };
    const pageListener = (error) => errors.push(error.message);
    page.on('console', consoleListener);
    page.on('pageerror', pageListener);
    try {
      await use(page);
    } finally {
      page.off('console', consoleListener);
      page.off('pageerror', pageListener);
      expect(errors, 'Browser console and page errors').toEqual([]);
    }
  },
});
export { expect };
