/** Verify session-independent shared helpers; guard and auth shell tests belong to auth. */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Avatar, getAvatar } from './Avatar.jsx';
import { FormField } from './FormField.jsx';

describe('role avatars', () => {
  it.each([
    ['admin', 'Admin avatar', '👑', 'bg-violet-600'],
    ['user', 'Contributor avatar', '📖', 'bg-indigo-500'],
  ])('renders the specified %s emoji and accent', (role, label, emoji, color) => {
    render(getAvatar(role));
    expect(screen.getByRole('img', { name: label })).toHaveTextContent(emoji);
    expect(screen.getByRole('img', { name: label })).toHaveClass(color);
  });
  it.each([undefined, 'unknown', 'toString'])(
    'renders a neutral guest for unknown role %s',
    (role) => {
      render(<Avatar role={role} />);
      expect(screen.getByRole('img', { name: 'Guest avatar' })).toHaveTextContent('W');
      expect(screen.getByRole('img')).toHaveClass('bg-slate-200');
    },
  );
});

describe('labeled native fields', () => {
  it('accepts native input and binds the required label and hint', async () => {
    const user = userEvent.setup();
    render(<FormField id="title" label="Title" hint="Use plain text." required />);
    const input = screen.getByRole('textbox', { name: 'Title' });
    await user.type(input, 'A thought');
    expect(input).toHaveValue('A thought');
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).toHaveAccessibleDescription('Use plain text.');
    expect(input).toHaveAttribute('aria-invalid', 'false');
  });
  it('associates validation with a multiline field and clears it when corrected', () => {
    const { rerender } = render(
      <FormField
        id="content"
        label="Content"
        multiline
        hint="Plain text only."
        error="Content is required."
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Content' });
    expect(input.tagName).toBe('TEXTAREA');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Plain text only. Content is required.');
    expect(screen.getByRole('alert')).toHaveTextContent('Content is required.');
    rerender(<FormField id="content" label="Content" multiline />);
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('associates an error with a field when no hint is present', () => {
    render(<FormField id="title" label="Title" error="Title is required." />);
    expect(screen.getByLabelText('Title')).toHaveAccessibleDescription('Title is required.');
  });
});

/** Verify role guards and native navigation disclosures. */
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import { Navbar } from './Navbar.jsx';
import { BUILTIN_ADMIN } from '../features/auth/session.js';
import { saveUsers } from '../features/posts/storage.js';
const userSession = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };
/** Persist a current contributor for identity-aware guard tests. */
function seedUser() {
  saveUsers([
    {
      id: 'u1',
      username: 'mira',
      displayName: 'Mira',
      password: 'demo',
      role: 'user',
      createdAt: '2026-03-04T12:00:00.000Z',
    },
  ]);
}

describe('local role guard', () => {
  it.each([null, { ...BUILTIN_ADMIN, role: 'invalid' }, { ...userSession, userId: 'deleted' }])(
    'fails closed for invalid identity %j',
    (session) => {
      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute session={session}>
                  <p>Allowed</p>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<p>Login destination</p>} />
          </Routes>
        </MemoryRouter>,
      );
      expect(screen.getByText('Login destination')).toBeInTheDocument();
      expect(screen.queryByText('Allowed')).not.toBeInTheDocument();
    },
  );
  it.each(['admin', 'user'])('allows a current %s via nested outlet', (role) => {
    seedUser();
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            element={<ProtectedRoute session={role === 'admin' ? BUILTIN_ADMIN : userSession} />}
          >
            <Route path="/protected" element={<p>Allowed</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Allowed')).toBeInTheDocument();
  });
  it('rejects a contributor from admin-only content', () => {
    seedUser();
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route
            path="/admin"
            element={
              <ProtectedRoute session={userSession} roles={['admin']}>
                <p>Admin content</p>
              </ProtectedRoute>
            }
          />
          <Route path="/blogs" element={<p>Blogs destination</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Blogs destination')).toBeInTheDocument();
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });
});

describe('authenticated navbar', () => {
  it('preserves the existing guest navigation', () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation', { name: 'Public navigation' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
  });
  it.each(['admin', 'user'])('shows %s role links and an active native link', (role) => {
    render(
      <MemoryRouter initialEntries={['/blogs']}>
        <Navbar session={role === 'admin' ? BUILTIN_ADMIN : userSession} onLogout={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'All Blogs' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'All Blogs' })).toHaveClass('bg-indigo-600');
    expect(screen.getByRole('link', { name: 'Write' })).toHaveAttribute('href', '/write');
    expect(screen.queryByRole('link', { name: 'Users' }) !== null).toBe(role === 'admin');
    expect(screen.getByRole('link', { name: 'WriteSpace' })).toHaveAttribute('href', '/');
  });
  it('opens logout, focuses it, closes on Escape and restores focus', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Navbar session={BUILTIN_ADMIN} onLogout={vi.fn()} />
      </MemoryRouter>,
    );
    const trigger = screen.getByRole('button', { name: 'Admin account' });
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Logout' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it('closes dropdown on outside click and tabbing away', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Navbar session={BUILTIN_ADMIN} onLogout={vi.fn()} />
        <button>Outside</button>
      </MemoryRouter>,
    );
    const trigger = screen.getByRole('button', { name: 'Admin account' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    await user.tab();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
  it('toggles mobile links, closes on Escape with focus restore, and closes after navigation', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Navbar session={BUILTIN_ADMIN} onLogout={vi.fn()} />
      </MemoryRouter>,
    );
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    expect(document.getElementById('authenticated-links')).toHaveClass('hidden');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('authenticated-links')).toHaveClass('flex');
    await user.click(screen.getByRole('link', { name: 'Write' }));
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
  it('displays logout failure without hiding current identity', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Navbar
          session={userSession}
          onLogout={() => {
            throw new Error('Could not log out.');
          }}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Mira account' }));
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not log out.');
    expect(screen.getByRole('button', { name: 'Mira account' })).toBeInTheDocument();
  });
});
