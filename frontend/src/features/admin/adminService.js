/** Manage browser-local demo accounts; plaintext passwords and role checks are not secure authentication. */
import { BUILTIN_ADMIN, getSession, isValidSession } from "../auth/session.js";
import { validateUsername } from "../auth/authService.js";
import { getUsers, saveUsers } from "../posts/storage.js";
import { getPosts, deletePost } from "../posts/postService.js";

/** Revalidate the actual active administrator before every service action.
 * Args:
 *   session: Candidate identity supplied by the current page.
 * Returns:
 *   Validated active administrator identity.
 * Raises:
 *   Error: Missing, forged, stale or non-admin session.
 */
export function requireAdmin(session) {
  const current = getSession();
  if (
    !isValidSession(session) ||
    !current ||
    current.role !== "admin" ||
    !["userId", "username", "displayName", "role"].every((key) => current[key] === session[key])
  ) {
    throw new Error("Your admin session is invalid or expired. Please log in again.");
  }
  return current;
}

/** List all accounts without exposing demo passwords.
 * Args:
 *   session: Active administrator identity.
 * Returns:
 *   Builtin Admin followed by stored accounts; builtin has no invented creation date.
 * Raises:
 *   Error: Invalid active admin session.
 */
export function listUsers(session) {
  requireAdmin(session);
  const accounts = getUsers().filter(
    (user) => user.id !== "admin" && user.username.toLowerCase() !== "admin",
  );
  return [
    { id: BUILTIN_ADMIN.userId, ...BUILTIN_ADMIN, createdAt: null },
    ...accounts.map(({ password, ...account }) => account),
  ];
}

/** Read clarified real metrics and the newest five posts.
 * Args:
 *   session: Active administrator identity.
 * Returns:
 *   Builtin-inclusive account counts and newest-first recent writing.
 * Raises:
 *   Error: Invalid active admin session.
 */
export function getDashboard(session) {
  const accounts = listUsers(session);
  const posts = getPosts();
  return {
    totalPosts: posts.length,
    totalUsers: accounts.length,
    totalAdmins: accounts.filter((account) => account.role === "admin").length,
    totalContributors: accounts.filter((account) => account.role === "user").length,
    recentPosts: posts.slice(0, 5),
  };
}

/** Validate required account fields and supported roles without changing state.
 * Args:
 *   values: Submitted display name, username, plaintext demo password and role.
 *   session: Active administrator identity.
 * Returns:
 *   Field-keyed errors, including reserved and case-insensitive duplicate usernames.
 * Raises:
 *   Error: Invalid active admin session.
 */
export function validateUser(values, session) {
  requireAdmin(session);
  const data = values && typeof values === "object" && !Array.isArray(values) ? values : {};
  const errors = {};
  if (typeof data.displayName !== "string" || !data.displayName.trim())
    errors.displayName = "Display Name is required.";
  const usernameError = validateUsername(data.username);
  if (usernameError) errors.username = usernameError;
  if (typeof data.password !== "string" || !data.password.trim())
    errors.password = "Password is required.";
  if (!["admin", "user"].includes(data.role)) errors.role = "Choose Admin or user.";
  return errors;
}

/** Persist accounts and check exact localStorage readback before reporting success.
 * Args:
 *   users: Complete replacement account collection.
 * Raises:
 *   Error: Write denial or mismatched/unavailable readback.
 */
function persistUsers(users) {
  saveUsers(users);
  try {
    if (localStorage.getItem("writespace_users") !== JSON.stringify(users))
      throw new Error("Account readback mismatch");
  } catch (cause) {
    throw new Error("Could not verify saved accounts. Enable browser storage and retry.", {
      cause,
    });
  }
}

/** Create an account without replacing the signed-in administrator session.
 * Args:
 *   values: Required account fields; supplied identity/date metadata is ignored.
 *   session: Active administrator identity.
 * Returns:
 *   Persisted account with generated UUID and timestamp.
 * Raises:
 *   Error: Session, field validation, identity generation or persistence failure.
 * Notes:
 *   Passwords remain plaintext in this local-only demo. Never use real credentials.
 */
export function createUser(values, session) {
  const errors = validateUser(values, session);
  if (Object.keys(errors).length)
    throw Object.assign(new Error("Please correct the highlighted fields."), { errors });
  const account = {
    id: crypto.randomUUID(),
    displayName: values.displayName.trim(),
    username: values.username.trim(),
    password: values.password,
    role: values.role,
    createdAt: new Date().toISOString(),
  };
  persistUsers([...getUsers(), account]);
  return account;
}

/** Remove a deletable account while retaining all posts and their author names.
 * Args:
 *   id: Exact stored account identity.
 *   session: Active administrator identity.
 * Returns:
 *   Removed account after verified persistence.
 * Raises:
 *   Error: Invalid session/identity, missing, builtin/current account or write failure.
 */
export function deleteUser(id, session) {
  const current = requireAdmin(session);
  if (typeof id !== "string" || !id.trim()) throw new Error("Choose an existing account.");
  if (id === "admin") throw new Error("Default admin cannot be deleted.");
  if (id === current.userId) throw new Error("You cannot delete your current account.");
  const users = getUsers();
  const account = users.find((user) => user.id === id);
  if (!account) throw new Error("Account not found.");
  if (account.username.toLowerCase() === "admin")
    throw new Error("Default admin cannot be deleted.");
  persistUsers(users.filter((user) => user.id !== id));
  return account;
}

/** Delegate recent-post removal to the existing post service after active admin validation.
 * Args:
 *   id: Exact post identity selected after UI confirmation.
 *   session: Active administrator identity.
 * Returns:
 *   Removed post after the post service verifies persistence.
 * Raises:
 *   Error: Invalid admin, missing post or persistence failure.
 */
export function deleteRecentPost(id, session) {
  requireAdmin(session);
  return deletePost(id, session);
}
