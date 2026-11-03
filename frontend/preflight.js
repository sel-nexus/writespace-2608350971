/** Capture representative theme surfaces as reviewable browser evidence. */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const settings = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter(line => line.includes('=') && !line.startsWith('#')).map(line => line.trim().split('=')));
const baseURL = process.env.E2E_BASE_URL || settings.E2E_BASE_URL;
const browser = await chromium.launch({ headless: true });
const output = [];
mkdirSync('review', { recursive: true });
try {
  for (const theme of ['light', 'dark']) {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
      await context.addInitScript(({ theme }) => localStorage.setItem('writespace_theme', theme), { theme });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      /** Save text evidence and a screenshot for one meaningful UI state. */
      async function capture(state) {
        const name = `${theme}-${mobile ? 'mobile' : 'desktop'}-${state}`;
        output.push(`\n## ${name}\n${JSON.stringify(await page.accessibility.snapshot(), null, 2)}`);
        output.push(JSON.stringify(await page.evaluate(() => ({ font: getComputedStyle(document.body).fontFamily, elements: [...document.querySelectorAll('h1, main, nav, form, input, textarea, button')].map(el => ({ tag: el.tagName, text: el.textContent?.slice(0, 80), foreground: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor })), overflow: document.documentElement.scrollWidth > innerWidth })), null, 2));
        output.push(await page.content());
        await page.screenshot({ path: `review/${name}.png`, fullPage: true });
      }
      await page.goto(baseURL);
      await capture('landing-empty');
      await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
      await page.getByRole('button', { name: 'Login', exact: true }).click();
      await capture('login-errors');
      await page.getByLabel('Username', { exact: true }).fill('admin');
      await page.getByLabel('Password', { exact: true }).fill('admin');
      await page.getByRole('button', { name: 'Login', exact: true }).click();
      await page.getByRole('heading', { name: 'Admin Dashboard', exact: true }).waitFor();
      await capture('admin-empty');
      await page.getByRole('link', { name: 'Write New Post', exact: true }).click();
      await page.getByLabel('Title', { exact: true }).fill('Theme review writing');
      await page.getByLabel('Content', { exact: true }).fill('Readable writing\nwith a live count.');
      await capture('editor-populated');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await page.getByRole('heading', { name: 'Theme review writing', exact: true }).waitFor();
      await capture('reader');
      output.push(`Browser errors: ${JSON.stringify(errors)}`);
      if (errors.length) throw new Error(errors.join('\n'));
      await context.close();
    }
  }
} finally {
  writeFileSync('../ui-preflight.txt', output.join('\n'), 'utf8');
  await browser.close();
}
