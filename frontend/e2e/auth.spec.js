/** Exercise browser-local auth, landing navigation and role-home redirects through real UI. */
import { test, expect } from './fixtures.js';

for (const account of [
  { role: 'admin', username: 'admin', password: 'admin', name: 'Admin', home: '/admin', heading: 'Admin Dashboard', avatar: 'Admin avatar' },
  { role: 'user', username: 'mira', password: 'demo', name: 'Mira', home: '/blogs', heading: 'All Blogs', avatar: 'Contributor avatar' },
]) {
  test(account.role + ' logs in, returns to landing, opens dashboard and redirects footer auth links home', async ({ page }) => {
    // Seed only a current local account; login must establish the session through UI.
    if (account.role === 'user') {
      await page.addInitScript(() => {
        localStorage.setItem('writespace_users', JSON.stringify([{
          id: 'u1', username: 'mira', displayName: 'Mira', password: 'demo',
          role: 'user', createdAt: '2026-03-04T12:00:00.000Z',
        }]));
      });
    }
    await page.goto('/');
    await page.getByRole('link', { name: 'Start Reading' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await page.getByLabel('Username', { exact: true }).fill(account.username);
    await page.getByLabel('Password', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(account.home + '$'));
    await expect(page.getByRole('heading', { level: 1, name: account.heading })).toBeVisible();
    const identity = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')));
    expect(identity).toEqual({
      userId: account.role === 'admin' ? 'admin' : 'u1',
      username: account.username, displayName: account.name, role: account.role,
    });
    await page.getByRole('navigation', { name: 'Authenticated navigation' }).getByRole('link', { name: 'WriteSpace' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'WriteSpace' })).toBeVisible();
    const publicNav = page.getByRole('navigation', { name: 'Public navigation' });
    const toggle = publicNav.getByRole('button', { name: 'Open menu' });
    if (await toggle.isVisible()) await toggle.click();
    await expect(publicNav.getByText(account.name, { exact: true })).toBeVisible();
    await expect(publicNav.getByRole('img', { name: account.avatar })).toBeVisible();
    await expect(publicNav.getByRole('link', { name: 'Login', exact: true })).toHaveCount(0);
    await expect(publicNav.getByRole('link', { name: 'Get Started', exact: true })).toHaveCount(0);
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Authenticated navigation' })).toHaveCount(0);
    await expect(publicNav.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', account.home);
    await publicNav.getByRole('link', { name: 'Go to Dashboard' }).click();
    await expect(page).toHaveURL(new RegExp(account.home + '$'));
    await expect(page.getByRole('heading', { level: 1, name: account.heading })).toBeVisible();

    for (const link of ['Login', 'Register']) {
      await page.getByRole('navigation', { name: 'Authenticated navigation' }).getByRole('link', { name: 'WriteSpace' }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { level: 1, name: 'WriteSpace' })).toBeVisible();
      const footerLink = page.getByRole('navigation', { name: 'Footer navigation' }).getByRole('link', { name: link, exact: true });
      await expect(footerLink).toHaveAttribute('href', '/' + link.toLowerCase());
      await footerLink.click();
      await expect(page).toHaveURL(new RegExp(account.home + '$'));
      await expect(page.getByRole('heading', { level: 1, name: account.heading })).toBeVisible();
      await expect(page.getByRole('button', { name: account.name + ' account' })).toBeVisible();
      await expect(page.getByLabel('Username', { exact: true })).toHaveCount(0);
      await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(identity);
    }
  });
}

test('registration persists across reload, logout clears session, and returning login works', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Get Started Free' }).first().click();
  await page.getByLabel('Display Name').fill('Mira');
  await page.getByLabel('Username', { exact: true }).fill('mira');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Confirm Password').fill('demo-only');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')));
  expect(session).toMatchObject({ username: 'mira', displayName: 'Mira', role: 'user' });
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users'))[0].id),
  ).toBe(session.userId);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Mira account' })).toBeVisible();
  const toggle = page.getByRole('button', { name: 'Open menu' });
  if (await toggle.isVisible()) {
    await toggle.click();
    await expect(page.getByRole('link', { name: 'All Blogs', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close menu' }).click();
  }
  await page.getByRole('button', { name: 'Mira account' }).click();
  await page.screenshot({ path: testInfo.outputPath('auth-dropdown.png') });
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.getByRole('link', { name: 'Start Reading' }).click();
  await page.getByLabel('Username', { exact: true }).fill('mira');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(
    session,
  );
});

test('invalid login reports exact error then builtin admin enters its role home', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Start Reading' }).click();
  await expect(page.getByText(/passwords are stored in plaintext/)).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(
    { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' },
  );
});

for (const path of ['/blogs', '/blog/demo', '/write', '/edit/demo', '/admin', '/users']) {
  test('guest direct-link entry ' + path + ' redirects to login', async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  });
}
for (const path of ['/admin', '/users']) {
  test('wrong-role direct-link entry ' + path + ' redirects to blogs', async ({ page }) => {
    // Current account and identity fixture, not a mock of application behavior.
    await page.addInitScript(() => {
      localStorage.setItem(
        'writespace_users',
        JSON.stringify([
          {
            id: 'u1',
            username: 'mira',
            displayName: 'Mira',
            password: 'demo',
            role: 'user',
            createdAt: '2026-03-04T12:00:00.000Z',
          },
        ]),
      );
      localStorage.setItem(
        'writespace_session',
        JSON.stringify({ userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' }),
      );
    });
    await page.goto(path);
    await expect(page).toHaveURL(/\/blogs$/);
    await expect(page.getByRole('button', { name: 'Mira account' })).toBeVisible();
  });
}
