/** Query and maintain validated browser-local writing with fail-closed ownership. */
import { getPosts as readPosts, getUsers, savePosts } from "./storage.js";
import { isValidSession } from "../auth/session.js";

/** Return all valid posts in newest-first order.
 * Returns:
 *   A fresh collection; equal creation times retain storage order.
 */
export function getPosts() {
  return readPosts().sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
}

/** Find a post by its exact stored identity.
 * Args:
 *   id: Requested post identity; missing or nonstring values are rejected.
 * Returns:
 *   Matching validated post, or null when absent or unreadable.
 */
export function getPost(id) {
  if (typeof id !== "string" || !id.trim()) return null;
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
  if (
    !isValidSession(session) ||
    !post ||
    typeof post.authorId !== "string" ||
    !post.authorId.trim()
  ) {
    return false;
  }
  return session.role === "admin" || session.userId === post.authorId;
}

/** Resolve a post author's avatar role without adding fields to the post model.
 * Args:
 *   post: Valid post with a retained author identity.
 * Returns:
 *   Builtin/current account role, or contributor for a deleted or unknown author.
 */
export function getAuthorRole(post) {
  if (post?.authorId === "admin") return "admin";
  return getUsers().find((user) => user.id === post?.authorId)?.role ?? "user";
}

/** Format a stored creation timestamp consistently across reader and cards.
 * Args:
 *   createdAt: Timestamp to display in UTC, independent of browser timezone.
 * Returns:
 *   English abbreviated month, padded day and year, or an unknown-date label.
 */
export function formatPostDate(createdAt) {
  if (typeof createdAt !== "string" || !Number.isFinite(Date.parse(createdAt)))
    return "Unknown date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(createdAt));
}

/** Validate plain-text fields independently without changing their literal contents.
 * Args:
 *   values: Candidate title and content; all other fields are ignored.
 * Returns:
 *   Field-keyed required messages for missing, blank or nonstring values.
 */
export function validatePost(values) {
  const errors = {};
  if (typeof values?.title !== "string" || !values.title.trim())
    errors.title = "Title is required.";
  if (typeof values?.content !== "string" || !values.content.trim())
    errors.content = "Content is required.";
  return errors;
}

/** Reject incomplete, forged or stale identities before each mutation.
 * Args:
 *   session: Candidate identity revalidated against current local accounts.
 * Raises:
 *   Error: Identity no longer matches a current account.
 */
function requireSession(session) {
  if (!isValidSession(session))
    throw new Error("Your session is invalid or expired. Please log in again.");
}

/** Reject invalid writing with individual field feedback.
 * Args:
 *   values: Candidate plain-text title and content.
 * Raises:
 *   Error: Required fields are invalid; errors contains field messages.
 */
function requireFields(values) {
  const errors = validatePost(values);
  if (Object.keys(errors).length) {
    throw Object.assign(new Error("Please correct the highlighted fields."), {
      errors,
    });
  }
}

/** Persist a collection and verify exact readback before reporting success.
 * Args:
 *   posts: Complete replacement collection in storage order.
 * Raises:
 *   Error: Browser writing or readback failed.
 */
function persistPosts(posts) {
  savePosts(posts);
  if (JSON.stringify(readPosts()) !== JSON.stringify(posts)) {
    throw new Error(
      "Could not verify saved writing. Enable browser storage and retry.",
    );
  }
}

/** Create literal writing with generated identity and current session authorship.
 * Args:
 *   values: Required title and content; supplied metadata is ignored.
 *   session: Current complete local identity.
 * Returns:
 *   Persisted post with a UUID and creation timestamp.
 * Raises:
 *   Error: Invalid session, fields, UUID generation or persistence.
 */
export function createPost(values, session) {
  requireSession(session);
  requireFields(values);
  const post = {
    id: crypto.randomUUID(),
    title: values.title,
    content: values.content,
    createdAt: new Date().toISOString(),
    authorId: session.userId,
    authorName: session.displayName,
  };
  persistPosts([...readPosts(), post]);
  return post;
}

/** Update only the literal fields of an existing manageable post.
 * Args:
 *   id: Exact stored identity, never coerced or trimmed.
 *   values: Required title and content; metadata changes are ignored.
 *   session: Current owner or Admin identity.
 * Returns:
 *   Persisted post retaining its original identity, author and creation date.
 * Raises:
 *   Error: Invalid session, missing post, denied ownership, fields or persistence.
 */
export function updatePost(id, values, session) {
  requireSession(session);
  const post = getPost(id);
  if (!post) throw new Error("Post not found.");
  if (!canManagePost(session, post))
    throw new Error("You can only manage your own posts.");
  requireFields(values);
  const updated = { ...post, title: values.title, content: values.content };
  persistPosts(readPosts().map((item) => (item.id === id ? updated : item)));
  return updated;
}

/** Remove an existing manageable post; confirmation belongs to the caller.
 * Args:
 *   id: Exact stored identity.
 *   session: Current owner or Admin identity.
 * Returns:
 *   Removed post after verified persistence.
 * Raises:
 *   Error: Invalid session, missing post, denied ownership or persistence.
 */
export function deletePost(id, session) {
  requireSession(session);
  const post = getPost(id);
  if (!post) throw new Error("Post not found.");
  if (!canManagePost(session, post))
    throw new Error("You can only manage your own posts.");
  persistPosts(readPosts().filter((item) => item.id !== id));
  return post;
}
