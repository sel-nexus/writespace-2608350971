/** Verify session-independent shared helpers; guard and auth shell tests belong to auth. */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Avatar, getAvatar } from './Avatar.jsx';
import { FormField } from './FormField.jsx';

describe('role avatars', () => {
  it.each([['admin', 'Admin avatar', '👑', 'bg-violet-600'], ['user', 'Contributor avatar', '📖', 'bg-indigo-500']])('renders the specified %s emoji and accent', (role, label, emoji, color) => {
    render(getAvatar(role));
    expect(screen.getByRole('img', { name: label })).toHaveTextContent(emoji);
    expect(screen.getByRole('img', { name: label })).toHaveClass(color);
  });
  it.each([undefined, 'unknown', 'toString'])('renders a neutral guest for unknown role %s', (role) => {
    render(<Avatar role={role} />);
    expect(screen.getByRole('img', { name: 'Guest avatar' })).toHaveTextContent('W');
    expect(screen.getByRole('img')).toHaveClass('bg-slate-200');
  });
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
      <FormField id="content" label="Content" multiline hint="Plain text only." error="Content is required." />,
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
