/** Verify paired public surfaces against real storage, form states and App routes. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../../App.jsx';
import { savePosts, saveUsers } from '../posts/storage.js';
import { BUILTIN_ADMIN, setSession } from '../auth/session.js';

const account = {
  id: 'writer', username: 'mira', displayName: 'Mira', password: 'demo',
  role: 'user', createdAt: '2026-03-04T12:00:00.000Z',
};
const post = {
  id: 'local/one', title: 'Local thought', content: 'A real saved story.',
  authorId: 'writer', authorName: 'Mira', createdAt: '2026-03-04T12:00:00.000Z',
};

afterEach(() => document.documentElement.classList.remove('dark'));

/** Expose actual router history without substituting destination pages. */
function CurrentRoute() {
  return <output aria-label="Current route">{useLocation().pathname}</output>;
}

/** Mount the real App with a raw saved theme and optional initial route. */
function mount(theme, path = '/') {
  localStorage.setItem('writespace_theme', theme);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <CurrentRoute />
    </MemoryRouter>,
  );
}

/** Assert the root/storage contract and every paired public text/surface utility. */
function expectSurfaces(theme) {
  expect(document.documentElement.classList.contains('dark')).toBe(theme === 'dark');
  expect(localStorage.getItem('writespace_theme')).toBe(theme);
  const pairs = {
    'bg-white': 'dark:bg-slate-900',
    'bg-slate-50': 'dark:bg-slate-800',
    'bg-red-50': 'dark:bg-red-950',
    'text-slate-900': 'dark:text-slate-100',
    'text-slate-800': 'dark:text-slate-200',
    'text-slate-700': 'dark:text-slate-200',
    'text-slate-600': 'dark:text-slate-300',
    'text-slate-500': 'dark:text-slate-400',
    'text-indigo-700': 'dark:text-indigo-300',
    'text-teal-800': 'dark:text-teal-300',
    'text-red-600': 'dark:text-red-300',
    'border-slate-200': 'dark:border-slate-700',
    'border-slate-300': 'dark:border-slate-600',
    'border-red-600': 'dark:border-red-400',
    'border-t-teal-500': 'dark:border-t-teal-400',
  };
  for (const element of document.querySelectorAll('main [class], footer[class], footer [class]')) {
    for (const [light, dark] of Object.entries(pairs)) {
      if (element.classList.contains(light)) {
        if (light === 'text-indigo-700' && element.classList.contains('border-indigo-200')) {
          expect(element).toHaveClass('dark:text-indigo-200');
          continue;
        }
        expect(element).toHaveClass(dark);
      }
    }
  }
  for (const control of document.querySelectorAll('main a, main input, main button, footer a')) {
    expect(control).toHaveClass('focus-visible:ring-indigo-600', 'dark:focus-visible:ring-indigo-400', 'dark:focus-visible:ring-offset-slate-900');
  }
}

describe.each(['light', 'dark'])('public surfaces in %s mode', (theme) => {
  it('pairs empty hero, all benefit cards, empty latest section and footer without changing links', () => {
    mount(theme);
    const preview = screen.getByRole('heading', { name: 'A space for your writing' }).closest('article');
    expect(preview).toHaveClass('bg-white', 'dark:bg-slate-900', 'dark:border-t-teal-400');
    expect(screen.getByText('No posts yet — check back soon!').parentElement).toHaveClass('bg-white', 'dark:bg-slate-900', 'dark:border-slate-600');
    for (const [name, classes] of [
      ['Write Freely', ['bg-indigo-50', 'dark:bg-indigo-950', 'dark:border-indigo-800']],
      ['Private & Local', ['bg-teal-50', 'dark:bg-teal-950', 'dark:border-teal-800']],
      ['Instant & Fast', ['bg-white', 'dark:bg-slate-900', 'dark:border-slate-700']],
    ]) {
      expect(screen.getByRole('heading', { name }).closest('article')).toHaveClass(...classes);
    }
    expect(screen.getByRole('contentinfo')).toHaveClass('bg-slate-900', 'dark:bg-slate-950', 'dark:text-slate-300');
    const footer = within(screen.getByRole('navigation', { name: 'Footer navigation' }));
    for (const [name, href] of [['Home', '/'], ['All Blogs', '/blogs'], ['Login', '/login'], ['Register', '/register']]) {
      expect(footer.getByRole('link', { name })).toHaveAttribute('href', href);
    }
    expect(screen.getByRole('link', { name: 'Start Reading' })).toHaveAttribute('href', '/login');
    expect(localStorage.getItem('writespace_posts')).toBeNull();
    expectSurfaces(theme);
  });

  it('pairs populated hero and latest previews while preserving real content and encoded routes', () => {
    savePosts([post]);
    const raw = localStorage.getItem('writespace_posts');
    mount(theme);
    for (const heading of screen.getAllByRole('heading', { name: post.title })) {
      expect(heading.closest('article')).toHaveClass('bg-white', 'dark:bg-slate-900');
      expect(within(heading.closest('article')).getByText(post.content)).toHaveClass('text-slate-600', 'dark:text-slate-300');
      expect(within(heading.closest('article')).getByText('Mar 04, 2026')).toHaveClass('dark:text-slate-300');
      expect(within(heading.closest('article')).getByRole('link')).toHaveAttribute('href', '/blog/local%2Fone');
    }
    expect(screen.queryByText('No posts yet — check back soon!')).not.toBeInTheDocument();
    expect(localStorage.getItem('writespace_posts')).toBe(raw);
    expectSurfaces(theme);
  });

  it.each([['/login', 'Login', ['Username', 'Password']], ['/register', 'Register', ['Display Name', 'Username', 'Password', 'Confirm Password']]])(
    'pairs %s form, labels, inputs, disclosure and actual required errors',
    async (path, submit, labels) => {
      const user = userEvent.setup();
      mount(theme, path);
      expect(screen.getByRole('heading', { level: 1 }).closest('section')).toHaveClass('bg-white', 'dark:bg-slate-900', 'dark:border-slate-700');
      expect(screen.getByText(/passwords are stored in plaintext/)).toHaveClass('bg-slate-50', 'dark:bg-slate-800');
      for (const label of labels) {
        const field = screen.getByLabelText(label, { exact: true });
        expect(field).toHaveClass('bg-white', 'dark:bg-slate-900', 'border-slate-300', 'dark:border-slate-600', 'dark:text-slate-200');
        expect(document.querySelector(`label[for="${field.id}"]`)).toHaveClass('text-slate-800', 'dark:text-slate-200');
      }
      await user.click(screen.getByRole('button', { name: submit, exact: true }));
      expect(screen.getAllByRole('alert')).toHaveLength(labels.length);
      for (const label of labels) {
        const field = screen.getByLabelText(label, { exact: true });
        expect(field).toHaveAttribute('aria-invalid', 'true');
        expect(field).toHaveClass('border-red-600', 'dark:border-red-400');
        const error = document.getElementById(field.getAttribute('aria-describedby'));
        expect(error).toHaveTextContent(label + ' is required.');
        expect(error).toHaveClass('text-red-600', 'dark:text-red-300');
      }
      expect(screen.getByLabelText(labels[0], { exact: true })).toHaveFocus();
      expect(screen.getByLabelText('Current route')).toHaveTextContent(path);
      expect(localStorage.getItem('writespace_session')).toBeNull();
      expectSurfaces(theme);
    },
  );

  it('pairs actual invalid-login banner and duplicate-registration field error without changing persisted accounts', async () => {
    saveUsers([account]);
    const rawUsers = localStorage.getItem('writespace_users');
    const user = userEvent.setup();
    mount(theme);
    await user.click(screen.getByRole('link', { name: 'Start Reading' }));
    await user.type(screen.getByLabelText('Username'), 'mira');
    await user.type(screen.getByLabelText('Password', { exact: true }), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Login', exact: true }));
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password.');
    expect(screen.getByRole('alert')).toHaveClass('bg-red-50', 'dark:bg-red-950', 'text-red-600', 'dark:text-red-300');
    expectSurfaces(theme);
    await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'Register' }));
    for (const [label, value] of [['Display Name', 'Mira'], ['Username', 'mira'], ['Password', 'demo'], ['Confirm Password', 'demo']]) {
      await user.type(screen.getByLabelText(label, { exact: true }), value);
    }
    await user.click(screen.getByRole('button', { name: 'Register', exact: true }));
    expect(screen.getByRole('alert')).toHaveTextContent('already taken');
    expect(screen.getByRole('alert')).toHaveClass('text-red-600', 'dark:text-red-300');
    expect(screen.getByLabelText('Username')).toHaveAttribute('aria-describedby', 'register-username-error');
    expect(screen.getByLabelText('Username')).toHaveClass('border-red-600', 'dark:border-red-400');
    expect(screen.getByLabelText('Display Name')).toHaveValue('Mira');
    expect(localStorage.getItem('writespace_users')).toBe(rawUsers);
    expect(localStorage.getItem('writespace_session')).toBeNull();
    expectSurfaces(theme);
  });

  it.each(['/login', '/register'])('pairs an actual failed-storage banner on %s and retains the form', async (path) => {
    const user = userEvent.setup();
    mount(theme, path);
    const fields = path === '/login'
      ? [['Username', 'admin'], ['Password', 'admin']]
      : [['Display Name', 'Mira'], ['Username', 'mira'], ['Password', 'demo'], ['Confirm Password', 'demo']];
    for (const [label, value] of fields) {
      await user.type(screen.getByLabelText(label, { exact: true }), value);
    }
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    await user.click(screen.getByRole('button', { name: path === '/login' ? 'Login' : 'Register', exact: true }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
    expect(screen.getByRole('alert')).toHaveClass('bg-red-50', 'dark:bg-red-950', 'text-red-600', 'dark:text-red-300');
    expect(screen.getByLabelText('Current route')).toHaveTextContent(path);
    expect(localStorage.getItem('writespace_session')).toBeNull();
    expect(localStorage.getItem('writespace_users')).toBeNull();
    expectSurfaces(theme);
  });

  it('registers via guest links, persists the unchanged identity shape, and returns to themed discovery on logout', async () => {
    const user = userEvent.setup();
    mount(theme);
    await user.click(within(screen.getByRole('navigation', { name: 'Footer navigation' })).getByRole('link', { name: 'Register' }));
    for (const [label, value] of [['Display Name', 'Mira'], ['Username', 'mira'], ['Password', 'demo'], ['Confirm Password', 'demo']]) {
      await user.type(screen.getByLabelText(label, { exact: true }), value);
    }
    expectSurfaces(theme);
    await user.click(screen.getByRole('button', { name: 'Register', exact: true }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
    const saved = JSON.parse(localStorage.getItem('writespace_users'))[0];
    expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual({ userId: saved.id, username: 'mira', displayName: 'Mira', role: 'user' });
    await user.click(screen.getByRole('button', { name: 'Mira account' }));
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByLabelText('Current route').textContent).toBe('/');
    expect(localStorage.getItem('writespace_session')).toBeNull();
    expectSurfaces(theme);
  });

  it.each(['admin', 'user'])('preserves %s authenticated landing and login/register role-home redirects', async (role) => {
    saveUsers([account]);
    setSession(role === 'admin' ? BUILTIN_ADMIN : { userId: account.id, username: account.username, displayName: account.displayName, role });
    const raw = localStorage.getItem('writespace_session');
    const user = userEvent.setup();
    mount(theme);
    expect(screen.getByRole('link', { name: 'Start Reading' })).toHaveAttribute('href', '/blogs');
    expectSurfaces(theme);
    for (const name of ['Login', 'Register']) {
      await user.click(within(screen.getByRole('navigation', { name: 'Footer navigation' })).getByRole('link', { name }));
      expect(screen.getByLabelText('Current route')).toHaveTextContent(role === 'admin' ? '/admin' : '/blogs');
      expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
      expect(localStorage.getItem('writespace_session')).toBe(raw);
      await user.click(screen.getByRole('link', { name: 'WriteSpace', exact: true }));
      expectSurfaces(theme);
    }
  });
});
