/** Persist local demo identity; client-side checks are not secure authentication. */
import { getUsers } from '../posts/storage.js';

export const SESSION_KEY = 'writespace_session';
export const BUILTIN_ADMIN = Object.freeze({
  userId: 'admin',
  username: 'admin',
  displayName: 'Admin',
  role: 'admin',
});
const fields = ['userId', 'username', 'displayName', 'role'];

/** Validate the complete identity against the current local accounts.
 * Args:
 *   session: Untrusted candidate identity.
 * Returns:
 *   Whether shape and current account identity match exactly; deleted accounts fail closed.
 */
export function isValidSession(session) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) return false;
  if (Object.keys(session).length !== fields.length) return false;
  if (!fields.every((field) => typeof session[field] === 'string' && session[field].trim()))
    return false;
  if (!['admin', 'user'].includes(session.role)) return false;
  if (session.userId === 'admin' || session.username === 'admin') {
    return fields.every((field) => session[field] === BUILTIN_ADMIN[field]);
  }
  return getUsers().some(
    (user) =>
      user.id === session.userId &&
      user.username === session.username &&
      user.displayName === session.displayName &&
      user.role === session.role,
  );
}

/** Read a session without altering malformed data.
 * Returns:
 *   Current validated identity, or null on malformed, deleted or unavailable data.
 */
export function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    return isValidSession(session) ? session : null;
  } catch {
    return null;
  }
}

/** Save only a current identity and verify persisted readback.
 * Args:
 *   session: Complete identity without password or extra fields.
 * Raises:
 *   Error: Invalid identity or unavailable/unsuccessful persistence.
 */
export function setSession(session) {
  if (!isValidSession(session))
    throw new Error('Cannot save an invalid or deleted local identity.');
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    const saved = getSession();
    if (!saved || !fields.every((field) => saved[field] === session[field]))
      throw new Error('Session readback failed');
  } catch (cause) {
    throw new Error(
      'Could not save your session. Enable browser storage and free local space, then retry. You are not signed in.',
      { cause },
    );
  }
}

/** Remove the local session, idempotently, and verify removal.
 * Raises:
 *   Error: Storage denied removal or readback; callers must not claim logout succeeded.
 */
export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
    if (localStorage.getItem(SESSION_KEY) !== null) throw new Error('Session removal failed');
  } catch (cause) {
    throw new Error('Could not log out. Enable browser storage, then retry.', { cause });
  }
}
