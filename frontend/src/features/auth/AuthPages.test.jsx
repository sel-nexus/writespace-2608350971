/** Verify entry forms and App wiring without inventing feature destination pages. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import LoginPage from './LoginPage.jsx';
import RegisterPage from './RegisterPage.jsx';
import { BUILTIN_ADMIN, getSession, setSession } from './session.js';
import { saveUsers, getUsers } from '../posts/storage.js';
import App from '../../App.jsx';
const account = {
  id: 'u1',
  displayName: 'Mira',
  username: 'mira',
  password: 'demo',
  role: 'user',
  createdAt: '2026-03-04T12:00:00.000Z',
};
const identity = { userId: 'u1', displayName: 'Mira', username: 'mira', role: 'user' };
/** Expose route outcomes without implementing downstream feature pages. */
function LocationMarker() {
  return <output aria-label="Current route">{useLocation().pathname}</output>;
}
/** Render a real entry form with marker destinations. */
function entry(Page, props = {}) {
  return render(
    <MemoryRouter initialEntries={['/entry']}>
      <Routes>
        <Route path="/entry" element={<Page onAuthenticated={vi.fn()} {...props} />} />
        <Route path="*" element={<LocationMarker />} />
      </Routes>
    </MemoryRouter>,
  );
}
/** Fill required registration controls through accessible labels. */
async function fillRegistration(user, omit) {
  for (const [label, value] of [
    ['Display Name', 'Mira'],
    ['Username', 'mira'],
    ['Password', 'demo'],
    ['Confirm Password', 'demo'],
  ]) {
    if (label !== omit) await user.type(screen.getByLabelText(label), value);
  }
}

describe('local entry forms', () => {
  it('discloses plaintext limits, exact builtin hint and native entry links', () => {
    entry(LoginPage);
    expect(screen.getByText(/passwords are stored in plaintext/)).toBeVisible();
    expect(screen.getByText(/Built-in demo credentials/)).toHaveTextContent(
      'username admin / password admin',
    );
    expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });
  it.each(['Username', 'Password'])(
    'rejects missing login %s individually and focuses its error',
    async (missing) => {
      const user = userEvent.setup();
      entry(LoginPage);
      await user.type(
        screen.getByLabelText(missing === 'Username' ? 'Password' : 'Username'),
        'admin',
      );
      await user.click(screen.getByRole('button', { name: 'Login' }));
      expect(screen.getByRole('alert')).toHaveTextContent(missing + ' is required.');
      expect(screen.getByLabelText(missing)).toHaveFocus();
      expect(getSession()).toBeNull();
    },
  );
  it('shows the exact invalid login error without redirecting', async () => {
    const user = userEvent.setup();
    entry(LoginPage);
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password.');
    expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled();
    expect(getSession()).toBeNull();
  });
  it.each(['user', 'admin'])('logs in a %s and redirects to its role marker', async (role) => {
    saveUsers([{ ...account, role }]);
    const user = userEvent.setup();
    entry(LoginPage);
    await user.type(screen.getByLabelText('Username'), 'mira');
    await user.type(screen.getByLabelText('Password'), 'demo');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent(
      role === 'admin' ? '/admin' : '/blogs',
    );
    expect(getSession()).toEqual({ ...identity, role });
  });
  it.each(['Display Name', 'Username', 'Password', 'Confirm Password'])(
    'requires registration %s individually',
    async (missing) => {
      const user = userEvent.setup();
      entry(RegisterPage);
      await fillRegistration(user, missing);
      await user.click(screen.getByRole('button', { name: 'Register' }));
      expect(screen.getByRole('alert')).toHaveTextContent(missing + ' is required.');
      expect(screen.getByLabelText(missing)).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText(missing)).toHaveFocus();
      expect(getUsers()).toEqual([]);
    },
  );
  it('reports password mismatch and preserves the form values', async () => {
    const user = userEvent.setup();
    entry(RegisterPage);
    await fillRegistration(user);
    await user.type(screen.getByLabelText('Confirm Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Passwords must match.');
    expect(screen.getByLabelText('Display Name')).toHaveValue('Mira');
    expect(getSession()).toBeNull();
  });
  it.each(['admin', 'mira'])('reports reserved/duplicate username %s', async (username) => {
    saveUsers([account]);
    const user = userEvent.setup();
    entry(RegisterPage);
    await fillRegistration(user, 'Username');
    await user.type(screen.getByLabelText('Username'), username);
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      username === 'admin' ? 'reserved' : 'already taken',
    );
    expect(getUsers()).toEqual([account]);
  });
  it('registers then reads back the session and redirects to blogs', async () => {
    const user = userEvent.setup();
    entry(RegisterPage);
    await fillRegistration(user);
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
    expect(getSession()).toMatchObject({ displayName: 'Mira', username: 'mira', role: 'user' });
    expect(getUsers()[0].id).toBe(getSession().userId);
  });
  it.each([LoginPage, RegisterPage])(
    'surfaces failed writes in %s without redirecting',
    async (Page) => {
      const user = userEvent.setup();
      entry(Page);
      if (Page === RegisterPage) await fillRegistration(user);
      else {
        await user.type(screen.getByLabelText('Username'), 'admin');
        await user.type(screen.getByLabelText('Password'), 'admin');
      }
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('denied');
      });
      await user.click(
        screen.getByRole('button', { name: Page === RegisterPage ? 'Register' : 'Login' }),
      );
      expect(screen.getByRole('alert')).toHaveTextContent(/Could not save/);
      expect(screen.queryByLabelText('Current route')).not.toBeInTheDocument();
      expect(getSession()).toBeNull();
    },
  );
  it('reports a registration session failure and rolls back the account', async () => {
    const user = userEvent.setup();
    entry(RegisterPage);
    await fillRegistration(user);
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'writespace_session') throw new Error('denied');
      return original.call(this, key, value);
    });
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Could not save your session/);
    expect(getUsers()).toEqual([]);
  });
  it.each([LoginPage, RegisterPage])(
    'redirects an already authenticated visitor from %s',
    (Page) => {
      entry(Page, { session: BUILTIN_ADMIN });
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/admin');
      expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
    },
  );
});

describe('App session ownership', () => {
  it('login updates the navbar, persisted state and logout returns home', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
        <LocationMarker />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/admin');
    expect(
      screen.getByRole('navigation', { name: 'Authenticated navigation' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Admin account' }));
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByLabelText('Current route').textContent).toBe('/');
    expect(getSession()).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Public navigation' })).toBeInTheDocument();
  });
  it('loads persisted identity and synchronizes deleted users on storage changes', () => {
    saveUsers([account]);
    setSession(identity);
    render(
      <MemoryRouter initialEntries={['/write']}>
        <App />
        <LocationMarker />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Mira account' })).toBeInTheDocument();
    saveUsers([]);
    act(() => window.dispatchEvent(new Event('storage')));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
  });
  it('failed logout retains identity and shows a visible error', async () => {
    setSession(BUILTIN_ADMIN);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
        <LocationMarker />
      </MemoryRouter>,
    );
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    await user.click(screen.getByRole('button', { name: 'Admin account' }));
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not log out.');
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/admin');
    expect(getSession()).toEqual(BUILTIN_ADMIN);
  });
  it.each(['/blogs', '/blog/id', '/write', '/edit/id', '/admin', '/users'])(
    'guards guest direct entry to %s',
    (path) => {
      render(
        <MemoryRouter initialEntries={[path]}>
          <App />
          <LocationMarker />
        </MemoryRouter>,
      );
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
    },
  );
  it.each(['/admin', '/users'])('redirects wrong-role direct entry to %s', (path) => {
    saveUsers([account]);
    setSession(identity);
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
        <LocationMarker />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
  });
});
