/** Enter the browser-local demo with plaintext passwords; never use real credentials. */
import { getUsers, saveUsers } from '../posts/storage.js';
import { BUILTIN_ADMIN, setSession } from './session.js';

/** Resolve the home for a supported local role.
 * Args:
 *   session: Validated local identity.
 * Returns:
 *   Role home, or login for an absent/unsupported identity.
 */
export function roleHome(session) {
  if (session?.role === 'admin') return '/admin';
  if (session?.role === 'user') return '/blogs';
  return '/login';
}

/** Report required and reserved/duplicate username errors.
 * Args:
 *   username: Candidate username; surrounding whitespace is ignored, case is preserved.
 * Returns:
 *   Field message, or an empty string when available.
 */
export function validateUsername(username) {
  if (typeof username !== 'string' || !username.trim()) return 'Username is required.';
  const name = username.trim();
  if (name.toLowerCase() === 'admin') return 'The admin username is reserved.';
  if (getUsers().some((user) => user.username.toLowerCase() === name.toLowerCase()))
    return 'Username is already taken.';
  return '';
}

/** Validate each self-registration field without mutating data.
 * Args:
 *   values: Submitted display name, username, password and confirmation.
 * Returns:
 *   Field-keyed validation messages; invalid input types are rejected.
 */
export function validateRegistration(values) {
  const data = values && typeof values === 'object' && !Array.isArray(values) ? values : {};
  const errors = {};
  if (typeof data.displayName !== 'string' || !data.displayName.trim())
    errors.displayName = 'Display Name is required.';
  const usernameError = validateUsername(data.username);
  if (usernameError) errors.username = usernameError;
  if (typeof data.password !== 'string' || !data.password.trim())
    errors.password = 'Password is required.';
  if (typeof data.confirmPassword !== 'string' || !data.confirmPassword.trim())
    errors.confirmPassword = 'Confirm Password is required.';
  else if (!errors.password && data.password !== data.confirmPassword)
    errors.confirmPassword = 'Passwords must match.';
  return errors;
}

/** Check builtin credentials first, then current local users, and persist identity.
 * Args:
 *   username, password: Local demo credentials; password comparison is exact plaintext.
 * Returns:
 *   Persisted session without password.
 * Raises:
 *   Error: Invalid credentials or failed session write.
 */
export function login(username, password) {
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    !username.trim() ||
    !password.trim()
  ) {
    throw new Error('Invalid username or password.');
  }
  let session;
  if (username.trim() === 'admin' && password === 'admin') session = { ...BUILTIN_ADMIN };
  else {
    const account = getUsers().find(
      (user) =>
        user.id !== 'admin' &&
        user.username.toLowerCase() !== 'admin' &&
        user.username === username.trim() &&
        user.password === password,
    );
    if (!account) throw new Error('Invalid username or password.');
    session = {
      userId: account.id,
      username: account.username,
      displayName: account.displayName,
      role: account.role,
    };
  }
  setSession(session);
  return session;
}

/** Register a contributor and establish a session only after persistence succeeds.
 * Args:
 *   values: Required name and credentials; caller-supplied roles are ignored.
 * Returns:
 *   Persisted contributor session.
 * Raises:
 *   Error: Field validation, account persistence, session persistence or rollback failure.
 * Notes:
 *   Passwords remain plaintext. On session failure restore the previous account collection.
 */
export function register(values) {
  const errors = validateRegistration(values);
  if (Object.keys(errors).length)
    throw Object.assign(new Error('Please correct the highlighted fields.'), { errors });
  const previous = getUsers();
  const account = {
    id: crypto.randomUUID(),
    displayName: values.displayName.trim(),
    username: values.username.trim(),
    password: values.password,
    role: 'user',
    createdAt: new Date().toISOString(),
  };
  saveUsers([...previous, account]);
  const session = {
    userId: account.id,
    username: account.username,
    displayName: account.displayName,
    role: account.role,
  };
  try {
    setSession(session);
  } catch (cause) {
    try {
      saveUsers(previous);
    } catch {
      throw new Error(
        'Your account was saved, but sign-in failed and the account could not be removed. Enable browser storage, then use Login.',
        { cause },
      );
    }
    throw cause;
  }
  return session;
}
