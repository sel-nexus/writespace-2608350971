/** Specify guest/session link contracts, real preview data and safe empty recovery. */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import LandingPage from './LandingPage.jsx';
import App from '../../App.jsx';
import { PublicNavbar } from '../../shared/PublicNavbar.jsx';
import { savePosts, saveUsers } from '../posts/storage.js';
import { BUILTIN_ADMIN, setSession, SESSION_KEY } from '../auth/session.js';

/** Expose test history so redirects are checked against actual App routes. */
function RouteLocation() {
  return <output aria-label="Current route">{useLocation().pathname}</output>;
}

/** Render discovery inside test-only history.
 * Args:
 *   session: Optional identity contract for CTA tests.
 * Returns:
 *   Testing Library render controls.
 */
function renderLanding(session) {
  return render(
    <MemoryRouter>
      <PublicNavbar session={session} />
      <LandingPage session={session} />
    </MemoryRouter>,
  );
}

const post = {
  id: 'one', title: 'First thought', content: 'A short local story.',
  createdAt: '2026-03-01T00:00:00.000Z', authorId: 'writer', authorName: 'Mira',
};

describe('public discovery', () => {
  it('renders the prescribed hero, all three benefits, empty text and honest disclosure', () => {
    renderLanding();
    expect(screen.getByRole('heading', { level: 1, name: 'WriteSpace' })).toBeVisible();
    expect(screen.getByText('Your thoughts. Your space. Beautifully simple.')).toBeVisible();
    for (const title of ['Write Freely', 'Private & Local', 'Instant & Fast']) {
      expect(screen.getByRole('heading', { name: title })).toBeVisible();
    }
    expect(screen.getByText('No posts yet — check back soon!')).toBeVisible();
    expect(screen.getByText(/Local-only demo.*never use real passwords/)).toBeVisible();
    expect(screen.getByText(`© ${new Date().getFullYear()} WriteSpace`)).toBeVisible();
  });

  it('points guest entry controls and every footer link to the intended routes', () => {
    renderLanding();
    const nav = within(screen.getByRole('navigation', { name: 'Public navigation' }));
    expect(nav.getByRole('link', { name: 'WriteSpace' })).toHaveAttribute('href', '/');
    expect(nav.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(nav.getByRole('link', { name: 'Get Started' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'Start Reading' })).toHaveAttribute('href', '/login');
    for (const link of screen.getAllByRole('link', { name: 'Get Started Free' })) {
      expect(link).toHaveAttribute('href', '/register');
    }
    const footer = within(screen.getByRole('navigation', { name: 'Footer navigation' }));
    for (const [name, href] of [['Home', '/'], ['All Blogs', '/blogs'], ['Login', '/login'], ['Register', '/register']]) {
      expect(footer.getByRole('link', { name })).toHaveAttribute('href', href);
    }
    expect(nav.queryByRole('link', { name: 'Go to Dashboard' })).not.toBeInTheDocument();
  });

  it.each([['admin', '/admin', 'Admin avatar'], ['user', '/blogs', 'Contributor avatar']])('honors %s identity props without implementing authentication', (role, dashboard, avatar) => {
    renderLanding({ role, displayName: 'Mira' });
    const nav = within(screen.getByRole('navigation', { name: 'Public navigation' }));
    expect(nav.getByText('Mira')).toBeVisible();
    expect(nav.getByRole('img', { name: avatar })).toBeVisible();
    expect(nav.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', dashboard);
    expect(nav.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'Get Started' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start Reading' })).toHaveAttribute('href', '/blogs');
  });

  it('does not treat an unknown role as authenticated', () => {
    renderLanding({ role: 'owner', displayName: 'Unknown' });
    expect(screen.getByRole('link', { name: 'Start Reading' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('link', { name: 'Go to Dashboard' })).not.toBeInTheDocument();
  });

  it('sorts real persisted posts newest first, limits to three and formats UTC dates', () => {
    savePosts([
      post,
      { ...post, id: 'newest', title: 'Newest', createdAt: '2026-03-04T23:59:00.000Z' },
      { ...post, id: 'third', title: 'Third', createdAt: '2026-03-02T12:00:00.000Z' },
      { ...post, id: 'second', title: 'Second', createdAt: '2026-03-03T12:00:00.000Z' },
    ]);
    renderLanding();
    const latest = within(screen.getByRole('region', { name: 'Latest from the Blog' }));
    expect(latest.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Newest', 'Second', 'Third']);
    expect(latest.getAllByRole('article')).toHaveLength(3);
    expect(latest.getByText('Mar 04, 2026')).toBeVisible();
    expect(latest.queryByText('First thought')).not.toBeInTheDocument();
    expect(latest.getByRole('link', { name: /Newest/ })).toHaveAttribute('href', '/blog/newest');
    expect(screen.queryByText('No posts yet — check back soon!')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('writespace_posts'))[0].id).toBe('one');
  });

  it.each([1, 2, 3])('renders exactly %i previews when fewer than four posts exist', (count) => {
    savePosts(Array.from({ length: count }, (_, i) => ({ ...post, id: `post-${i}` })));
    renderLanding();
    const latest = within(screen.getByRole('region', { name: 'Latest from the Blog' }));
    expect(latest.getAllByRole('article')).toHaveLength(count);
  });

  it('truncates at 120 characters and escapes markup in title and content', () => {
    const title = '<img src=x onerror=alert(1)>';
    const content = '<script>alert(1)</script>' + 'x'.repeat(200);
    savePosts([{ ...post, id: 'id/with space', title, content }]);
    renderLanding();
    const region = screen.getByRole('region', { name: 'Latest from the Blog' });
    const latest = within(region);
    expect(latest.getByRole('heading', { name: title })).toHaveTextContent(title);
    expect(latest.getByText(content.slice(0, 120) + '…')).toBeVisible();
    expect(region.querySelector('script, img')).toBeNull();
    expect(latest.getByRole('link')).toHaveAttribute('href', '/blog/id%2Fwith%20space');
  });

  it('does not add an ellipsis to exactly 120 characters', () => {
    savePosts([{ ...post, content: 'x'.repeat(120) }]);
    renderLanding();
    const latest = within(screen.getByRole('region', { name: 'Latest from the Blog' }));
    expect(latest.getByText('x'.repeat(120))).toBeVisible();
    expect(latest.queryByText('x'.repeat(120) + '…')).not.toBeInTheDocument();
  });

  it.each(['{broken', '[{"id":"missing fields"}]'])('shows the empty state for corrupted persisted data: %s', (raw) => {
    localStorage.setItem('writespace_posts', raw);
    renderLanding();
    expect(screen.getByText('No posts yet — check back soon!')).toBeVisible();
    expect(localStorage.getItem('writespace_posts')).toBe(raw);
  });

  it('shows an empty state when browser reads are unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
    renderLanding();
    expect(screen.getByText('No posts yet — check back soon!')).toBeVisible();
  });

  it('opens and closes the mobile disclosure using pointer, Escape and selected links', async () => {
    const user = userEvent.setup();
    renderLanding();
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'public-links');
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    await user.click(within(screen.getByRole('navigation', { name: 'Public navigation' })).getByRole('link', { name: 'Login' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps unknown-route recovery and opens the real login form from Start Reading', async () => {
    const user = userEvent.setup();
    localStorage.setItem('writespace_theme', 'dark');
    render(
      <MemoryRouter initialEntries={['/not-a-page']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    expect(document.documentElement).toHaveClass('dark');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toHaveClass('text-slate-900', 'dark:text-slate-100');
    expect(screen.getByText(/This address is not available/)).toHaveClass('text-slate-600', 'dark:text-slate-300');
    const recovery = screen.getByRole('link', { name: 'Back to Home' });
    expect(recovery).toBeVisible();
    expect(recovery).toHaveAttribute('href', '/');
    await user.click(recovery);
    expect(screen.getByRole('heading', { level: 1, name: 'WriteSpace' })).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Start Reading' }));
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Username' })).toBeVisible();
    expect(screen.getByLabelText('Password', { exact: true })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Login', exact: true })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Page not found' })).not.toBeInTheDocument();
  });

  it.each([
    ['admin', '/admin', 'Admin', 'Admin avatar', 'Admin Dashboard'],
    ['user', '/blogs', 'Mira', 'Contributor avatar', 'All Blogs'],
  ])('uses the landing header and role-home routes in actual App for %s', async (role, home, name, avatar, heading) => {
    const user = userEvent.setup();
    saveUsers([{
      id: 'u1', username: 'mira', displayName: 'Mira', password: 'demo',
      role: 'user', createdAt: '2026-03-04T12:00:00.000Z',
    }]);
    const identity = role === 'admin' ? BUILTIN_ADMIN : {
      userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user',
    };
    setSession(identity);
    render(
      <MemoryRouter>
        <App />
        <RouteLocation />
      </MemoryRouter>,
    );
    const nav = within(screen.getByRole('navigation', { name: 'Public navigation' }));
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.queryByRole('navigation', { name: 'Authenticated navigation' })).not.toBeInTheDocument();
    expect(nav.getByText(name)).toBeVisible();
    expect(nav.getByRole('img', { name: avatar })).toBeVisible();
    expect(nav.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', home);
    expect(nav.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'Get Started' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start Reading' })).toHaveAttribute('href', '/blogs');
    await user.click(nav.getByRole('link', { name: 'Go to Dashboard' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent(home);
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeVisible();

    for (const link of ['Login', 'Register']) {
      const authenticatedNav = within(screen.getByRole('navigation', { name: 'Authenticated navigation' }));
      expect(authenticatedNav.getByRole('button', { name: name + ' account' })).toBeVisible();
      expect(authenticatedNav.getByRole('link', { name: 'All Blogs' })).toHaveAttribute('href', '/blogs');
      expect(authenticatedNav.getByRole('link', { name: 'Write' })).toHaveAttribute('href', '/write');
      if (role === 'admin') {
        expect(authenticatedNav.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/users');
      } else {
        expect(authenticatedNav.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
      }
      expect(screen.queryByRole('navigation', { name: 'Public navigation' })).not.toBeInTheDocument();
      await user.click(authenticatedNav.getByRole('link', { name: 'WriteSpace' }));
      expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/$/);
      const footer = within(screen.getByRole('navigation', { name: 'Footer navigation' }));
      expect(footer.getByRole('link', { name: link })).toHaveAttribute('href', '/' + link.toLowerCase());
      await user.click(footer.getByRole('link', { name: link }));
      expect(screen.getByLabelText('Current route')).toHaveTextContent(home);
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: name + ' account' }));
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/$/);
    expect(screen.getByRole('heading', { level: 1, name: 'WriteSpace' })).toBeVisible();
    expect(within(screen.getByRole('navigation', { name: 'Public navigation' })).getByRole('link', { name: 'Login' })).toBeVisible();
    expect(screen.getAllByRole('banner')).toHaveLength(1);
  });
});
