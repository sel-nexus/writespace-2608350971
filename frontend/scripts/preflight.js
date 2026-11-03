/** Capture representative accessibility, style and markup evidence for human review. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadEnv } from 'vite';

const env = loadEnv('development', process.cwd(), '');
const browser = await chromium.launch({ headless: true });
const output = [];
await mkdir('review', { recursive: true });
try {
  for (const [name, width, path] of [
    ['landing-desktop', 1280, '/'],
    ['login-error-mobile', 390, '/login'],
    ['admin-desktop', 1280, '/admin'],
    ['users-mobile', 390, '/users'],
  ]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    if (path === '/admin' || path === '/users') {
      await page.addInitScript(() => {
        localStorage.setItem('writespace_session', JSON.stringify({
          userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin',
        }));
      });
    }
    await page.goto(new URL(path, env.E2E_BASE_URL).href);
    await page.getByRole('heading', { level: 1 }).waitFor();
    if (path === '/login') await page.getByRole('button', { name: 'Login', exact: true }).click();
    const styles = await page.evaluate(() => ({
      font: getComputedStyle(document.body).fontFamily,
      headingFont: getComputedStyle(document.querySelector('h1')).fontFamily,
      overflow: document.documentElement.scrollWidth > innerWidth,
      width: innerWidth,
    }));
    output.push(`STATE ${name}\n${JSON.stringify(styles)}\nACCESSIBILITY\n${JSON.stringify(await page.accessibility.snapshot(), null, 2)}\nHTML\n${await page.content()}`);
    await page.screenshot({ path: `review/${name}.png`, fullPage: true });
    await page.close();
  }
  await writeFile('review/preflight.txt', output.join('\n\n'), 'utf8');
} finally {
  await browser.close();
}
