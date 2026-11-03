/** Exercise public discovery through links; intended later routes currently show not-found. */
import { test, expect } from './fixtures.js';

test('guest discovers the local demo and navigates its entry links', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'WriteSpace' })).toBeVisible();
  await expect(page.getByText('Your thoughts. Your space. Beautifully simple.')).toBeVisible();
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  for (const name of ['Write Freely', 'Private & Local', 'Instant & Fast']) {
    await expect(page.getByRole('heading', { name })).toBeVisible();
  }
  await expect(page.getByText(/Local-only demo.*never use real passwords/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('discovery.png'), fullPage: true });
  const nav = page.getByRole('navigation', { name: 'Public navigation' });
  const toggle = page.getByRole('button', { name: 'Open menu' });
  if (await toggle.isVisible()) {
    await expect(nav.getByRole('link', { name: 'Login' })).toBeHidden();
    await toggle.click();
    await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  }
  await expect(nav.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
  await expect(nav.getByRole('link', { name: 'Get Started' })).toHaveAttribute('href', '/register');
  await page.getByRole('link', { name: 'Start Reading' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Home' }).click();
  await page.getByRole('link', { name: 'Get Started Free' }).first().click();
  await expect(page).toHaveURL(/\/register$/);
  await page.getByRole('link', { name: 'Back to Home' }).click();
  const footer = page.getByRole('navigation', { name: 'Footer navigation' });
  await expect(footer.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  await expect(footer.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
  await expect(footer.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
  await footer.getByRole('link', { name: 'All Blogs' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await page.getByRole('link', { name: 'Back to Home' }).click();
  await expect(page.getByRole('heading', { name: 'Latest from the Blog' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('previews real stored writing newest first and retains it across navigation and reload', async ({ page }) => {
  const posts = [1, 4, 2, 3].map((day) => ({
    id: `post-${day}`, title: `Local thought ${day}`, content: `Writing ${day} ` + 'x'.repeat(140),
    createdAt: `2026-03-0${day}T12:00:00.000Z`, authorId: 'demo-writer', authorName: 'Mira',
  }));
  // Set up actual browser-local records before initial entry, without mocking app code.
  await page.addInitScript((records) => {
    if (!localStorage.getItem('writespace_posts')) localStorage.setItem('writespace_posts', JSON.stringify(records));
  }, posts);
  await page.goto('/');
  const latest = page.getByRole('region', { name: 'Latest from the Blog' });
  await expect(latest.getByRole('heading', { level: 3 })).toHaveText(['Local thought 4', 'Local thought 3', 'Local thought 2']);
  await expect(latest.getByRole('article')).toHaveCount(3);
  await expect(latest.getByText('Mar 04, 2026')).toBeVisible();
  await expect(latest.getByText(posts[1].content.slice(0, 120) + '…')).toBeVisible();
  await expect(latest.getByRole('link', { name: /Local thought 4/ })).toHaveAttribute('href', '/blog/post-4');
  await latest.getByRole('link', { name: /Local thought 4/ }).click();
  await expect(page).toHaveURL(/\/blog\/post-4$/);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Home' }).click();
  await page.reload();
  await expect(latest.getByRole('heading', { level: 3 })).toHaveText(['Local thought 4', 'Local thought 3', 'Local thought 2']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
});

test('corrupt browser data degrades gracefully and reduced motion disables the floating card', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('writespace_posts', '{corrupt'));
  await page.goto('/');
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  expect(await page.locator('.writespace-floating-card').evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe('{corrupt');
});

test('literal markup is safe in saved preview titles and content', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('writespace_posts', JSON.stringify([{
    id: 'literal', title: '<img src=x onerror=alert(1)>', content: '<script>throw Error("XSS")</script>',
    createdAt: '2026-03-04T12:00:00.000Z', authorId: 'writer', authorName: 'Mira',
  }])));
  await page.goto('/');
  const latest = page.getByRole('region', { name: 'Latest from the Blog' });
  await expect(latest.getByRole('heading', { name: '<img src=x onerror=alert(1)>' })).toBeVisible();
  await expect(latest.getByText('<script>throw Error("XSS")</script>')).toBeVisible();
  await expect(latest.locator('img, script')).toHaveCount(0);
});
