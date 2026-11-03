/** Exercise public dark surfaces through clicked guest/auth routes and real browser storage. */
import { test, expect } from './fixtures.js';

const post = {
  id: 'public-post', title: 'Browser-local preview', content: 'Saved words in this browser.',
  authorId: 'writer', authorName: 'Mira', createdAt: '2026-03-04T12:00:00.000Z',
};

/** Verify exact raw theme persistence alongside the applied root class. */
async function expectDark(page) {
  await expect(page.locator('html')).toHaveClass(/(?:^|\s)dark(?:\s|$)/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('dark');
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
}

/** Check actual form colors, including field focus, rather than only utility names. */
async function expectDarkForm(page) {
  const section = page.locator('main section');
  await expect(section).toHaveCSS('background-color', 'rgb(15, 23, 42)');
  await expect(section).toHaveCSS('border-top-color', 'rgb(51, 65, 85)');
  await expect(section.locator('h1')).toHaveCSS('color', 'rgb(241, 245, 249)');
  await expect(section.getByText(/passwords are stored in plaintext/)).toHaveCSS('background-color', 'rgb(30, 41, 59)');
  for (const input of await section.locator('input').all()) {
    await expect(input).toHaveCSS('background-color', 'rgb(15, 23, 42)');
    await expect(input).toHaveCSS('color', 'rgb(226, 232, 240)');
  }
  for (const label of await section.locator('label').all()) {
    await expect(label).toHaveCSS('color', 'rgb(226, 232, 240)');
  }
  await page.getByLabel('Username', { exact: true }).focus();
  await page.keyboard.press('Tab');
  const password = page.getByLabel('Password', { exact: true });
  await expect(password).toBeFocused();
  expect(await password.evaluate((element) => getComputedStyle(element).boxShadow)).toContain('rgb(129, 140, 248)');
  await expect(section.getByRole('link', { name: 'WriteSpace', exact: true })).toHaveCSS('color', 'rgb(165, 180, 252)');
  await expectDark(page);
}

/** Assert responsive page bounds without changing the inherited composition. */
async function expectNoOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  for (const populated of [false, true]) {
    test(`public dark preview and auth journey at ${viewport.width}, populated=${populated}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      if (populated) {
        await page.addInitScript((savedPost) => localStorage.setItem('writespace_posts', JSON.stringify([savedPost])), post);
      }
      await page.goto('/');
      const rawPosts = await page.evaluate(() => localStorage.getItem('writespace_posts'));
      const hero = page.getByRole('region', { name: 'WriteSpace' });
      await expect(page.locator('main article').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
      await page.getByRole('button', { name: 'Switch to dark mode' }).click();
      await expectDark(page);
      await expect(page.locator('main article').first()).toHaveCSS('background-color', 'rgb(15, 23, 42)');
      const latest = page.getByRole('region', { name: 'Latest from the Blog' });
      if (populated) {
        await expect(hero.getByRole('heading', { name: post.title })).toBeVisible();
        await expect(latest.getByRole('heading', { name: post.title })).toHaveCSS('color', 'rgb(241, 245, 249)');
        await expect(latest.getByText(post.content)).toHaveCSS('color', 'rgb(203, 213, 225)');
        await expect(latest.locator('time')).toHaveCSS('color', 'rgb(203, 213, 225)');
        await expect(latest.getByText('Read post')).toHaveCSS('color', 'rgb(165, 180, 252)');
        await expect(latest.getByRole('link')).toHaveAttribute('href', '/blog/public-post');
        await expect(latest.getByText('No posts yet — check back soon!')).toHaveCount(0);
      } else {
        await expect(hero.getByRole('heading', { name: 'A space for your writing' })).toHaveCSS('color', 'rgb(241, 245, 249)');
        await expect(latest.getByText('No posts yet — check back soon!')).toHaveCSS('color', 'rgb(226, 232, 240)');
        await expect(latest.locator('.border-dashed')).toHaveCSS('background-color', 'rgb(15, 23, 42)');
      }
      for (const [name, background] of [['Write Freely', 'rgb(30, 27, 75)'], ['Private & Local', 'rgb(4, 47, 46)'], ['Instant & Fast', 'rgb(15, 23, 42)']]) {
        const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) });
        await expect(card).toHaveCSS('background-color', background);
        await expect(card.locator('p')).toHaveCSS('color', 'rgb(203, 213, 225)');
      }
      await expect(page.getByRole('contentinfo')).toHaveCSS('background-color', 'rgb(2, 6, 23)');
      await expect(page.getByRole('contentinfo')).toHaveCSS('color', 'rgb(203, 213, 225)');
      await expectNoOverflow(page);
      if (viewport.width === 390) {
        const nav = page.getByRole('navigation', { name: 'Public navigation' });
        await nav.getByRole('button', { name: 'Open menu' }).click();
        await expect(nav.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
        await nav.getByRole('link', { name: 'Login', exact: true }).click();
        await expect(nav.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
      } else {
        await page.getByRole('link', { name: 'Start Reading' }).click();
      }
      await expect(page).toHaveURL(/\/login$/);
      await expectDarkForm(page);
      await page.getByRole('button', { name: 'Login', exact: true }).click();
      await expect(page.getByRole('alert')).toHaveCount(2);
      await expect(page.getByLabel('Username', { exact: true })).toBeFocused();
      for (const error of await page.getByRole('alert').all()) {
        await expect(error).toHaveCSS('color', 'rgb(252, 165, 165)');
      }
      await expect(page.getByLabel('Username', { exact: true })).toHaveCSS('border-top-color', 'rgb(248, 113, 113)');
      await page.getByLabel('Username', { exact: true }).fill('admin');
      await page.getByLabel('Password', { exact: true }).fill('wrong');
      await page.getByRole('button', { name: 'Login', exact: true }).click();
      await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
      await expect(page.getByRole('alert')).toHaveCSS('background-color', 'rgb(69, 10, 10)');
      await expect(page.getByRole('alert')).toHaveCSS('color', 'rgb(252, 165, 165)');
      expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
      await page.locator('main').getByRole('link', { name: 'Register', exact: true }).click();
      await expect(page).toHaveURL(/\/register$/);
      await expectDarkForm(page);
      await page.getByRole('button', { name: 'Register', exact: true }).click();
      await expect(page.getByRole('alert')).toHaveCount(4);
      await expect(page.getByLabel('Display Name', { exact: true })).toBeFocused();
      for (const error of await page.getByRole('alert').all()) {
        await expect(error).toHaveCSS('color', 'rgb(252, 165, 165)');
      }
      for (const [label, value] of [['Display Name', 'Mira'], ['Username', 'mira'], ['Password', 'demo'], ['Confirm Password', 'different']]) {
        await page.getByLabel(label, { exact: true }).fill(value);
      }
      await page.getByRole('button', { name: 'Register', exact: true }).click();
      await expect(page.getByRole('alert')).toHaveText('Passwords must match.');
      await expect(page.getByRole('alert')).toHaveCSS('color', 'rgb(252, 165, 165)');
      await expect(page.getByLabel('Confirm Password', { exact: true })).toHaveCSS('border-top-color', 'rgb(248, 113, 113)');
      expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBeNull();
      await page.getByLabel('Confirm Password', { exact: true }).fill('demo');
      await expectNoOverflow(page);
      await page.getByRole('button', { name: 'Register', exact: true }).click();
      await expect(page).toHaveURL(/\/blogs$/);
      await expectDark(page);
      const rawUsers = await page.evaluate(() => localStorage.getItem('writespace_users'));
      const saved = JSON.parse(rawUsers)[0];
      expect(saved).toMatchObject({ username: 'mira', displayName: 'Mira', password: 'demo', role: 'user' });
      expect(JSON.parse(await page.evaluate(() => localStorage.getItem('writespace_session')))).toEqual({ userId: saved.id, username: 'mira', displayName: 'Mira', role: 'user' });
      await page.getByRole('button', { name: 'Mira account' }).click();
      await page.getByRole('button', { name: 'Logout' }).click();
      await expect(page).toHaveURL(/\/$/);
      await expectDark(page);
      expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
      await page.getByRole('navigation', { name: 'Footer navigation' }).getByRole('link', { name: 'Register', exact: true }).click();
      for (const [label, value] of [['Display Name', 'Mira'], ['Username', 'mira'], ['Password', 'demo'], ['Confirm Password', 'demo']]) {
        await page.getByLabel(label, { exact: true }).fill(value);
      }
      await page.getByRole('button', { name: 'Register', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('already taken');
      await expect(page.getByLabel('Username', { exact: true })).toHaveAttribute('aria-describedby', 'register-username-error');
      await expect(page.getByLabel('Username', { exact: true })).toHaveCSS('border-top-color', 'rgb(248, 113, 113)');
      await expect(page.getByRole('alert')).toHaveCSS('color', 'rgb(252, 165, 165)');
      expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBe(rawUsers);
      expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
      await page.locator('main').getByRole('link', { name: 'Login', exact: true }).click();
      await page.getByLabel('Username', { exact: true }).fill('mira');
      await page.getByLabel('Password', { exact: true }).fill('demo');
      await page.getByRole('button', { name: 'Login', exact: true }).click();
      await expect(page).toHaveURL(/\/blogs$/);
      await expect(page.getByRole('navigation', { name: 'Authenticated navigation' })).toBeVisible();
      await expectDark(page);
      expect(JSON.parse(await page.evaluate(() => localStorage.getItem('writespace_session'))).userId).toBe(saved.id);
      expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe(rawPosts);
      await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
      await expect(page).toHaveURL(/\/$/);
      const nav = page.getByRole('navigation', { name: 'Public navigation' });
      if (viewport.width === 390) await nav.getByRole('button', { name: 'Open menu' }).click();
      await nav.getByRole('link', { name: 'Go to Dashboard' }).click();
      await expect(page).toHaveURL(/\/blogs$/);
      await expectDark(page);
    });
  }
}
