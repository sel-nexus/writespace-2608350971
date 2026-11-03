/** Query validated browser-local writing without changing stored records. */
import { getPosts as readPosts, getUsers } from './storage.js';
import { isValidSession } from '../auth/session.js';

/** Return all valid posts in newest-first order.
 * Returns:
 *   A fresh collection; equal creation times retain storage order.
 */
export function getPosts() {
  return readPosts().sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

/** Find a post by its exact stored identity.
 * Args:
 *   id: Requested post identity; missing or nonstring values are rejected.
 * Returns:
 *   Matching validated post, or null when absent or unreadable.
 */
export function getPost(id) {
  if (typeof id !== 'string' || !id.trim()) return null;
  return getPosts().find((post) => post.id === id) ?? null;
}

/** Check local management rights against a current complete identity.
 * Args:
 *   session: Candidate identity to revalidate against current accounts.
 *   post: Post whose author determines contributor ownership.
 * Returns:
 *   Whether a current Admin or the current author may manage this post.
 * Notes:
 *   This client-side predicate is demo behavior, not server authorization.
 */
export function canManagePost(session, post) {
  if (!isValidSession(session) || !post || typeof post.authorId !== 'string' || !post.authorId.trim()) {
    return false;
  }
  return session.role === 'admin' || session.userId === post.authorId;
}

/** Resolve a post author's avatar role without adding fields to the post model.
 * Args:
 *   post: Valid post with a retained author identity.
 * Returns:
 *   Builtin/current account role, or contributor for a deleted or unknown author.
 */
export function getAuthorRole(post) {
  if (post?.authorId === 'admin') return 'admin';
  return getUsers().find((user) => user.id === post?.authorId)?.role ?? 'user';
}

/** Format a stored creation timestamp consistently across reader and cards.
 * Args:
 *   createdAt: Timestamp to display in UTC, independent of browser timezone.
 * Returns:
 *   English abbreviated month, padded day and year, or an unknown-date label.
 */
export function formatPostDate(createdAt) {
  if (typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt))) return 'Unknown date';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(createdAt));
}
