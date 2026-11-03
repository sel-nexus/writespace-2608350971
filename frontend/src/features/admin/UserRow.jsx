/** Render semantic desktop account rows and compact mobile account cards. */
import PropTypes from "prop-types";
import { Avatar } from "../../shared/Avatar.jsx";
import { buttonBase } from "../../shared/styles.js";
import { formatPostDate } from "../posts/postService.js";
const badges = {
  admin: "bg-violet-100 text-violet-800 ring-violet-300",
  user: "bg-indigo-100 text-indigo-800 ring-indigo-300",
};
/** Show an account and explain permanent or current-account deletion protection.
 * Args:
 *   user: Account without rendered credentials.
 *   currentUserId: Signed-in account identity.
 *   onDelete: Request confirmation and service removal.
 *   mobile: Render a stacked article rather than a table row.
 * Returns:
 *   Account record with a native Delete button.
 */
export function UserRow({ user, currentUserId, onDelete, mobile = false }) {
  const reason =
    user.id === "admin"
      ? "Default admin cannot be deleted."
      : user.id === currentUserId
        ? "You cannot delete your current account."
        : "";
  const identity = (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar role={user.role} />
      <span className="break-words font-semibold">{user.displayName}</span>
    </div>
  );
  const badge = (
    <span role="status" className={"rounded-full px-3 py-1 text-sm ring-1 " + badges[user.role]}>
      {user.role === "admin" ? "Admin" : "user"}
    </span>
  );
  const date = user.createdAt ? (
    <time dateTime={user.createdAt}>{formatPostDate(user.createdAt)}</time>
  ) : (
    "Built-in account"
  );
  const action = (
    <button
      type="button"
      aria-label={"Delete " + user.username}
      title={reason || "Delete account"}
      disabled={Boolean(reason)}
      onClick={() => onDelete(user)}
      className={
        buttonBase +
        " border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      Delete
    </button>
  );
  if (mobile)
    return (
      <article
        aria-label={"Account " + user.username}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
      >
        {identity}
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <dt className="text-slate-600">Username</dt>
          <dd className="break-all">{user.username}</dd>
          <dt className="text-slate-600">Role</dt>
          <dd>{badge}</dd>
          <dt className="text-slate-600">Created</dt>
          <dd>{date}</dd>
        </dl>
        {action}
        {reason && <p className="text-sm text-slate-600">{reason}</p>}
      </article>
    );
  return (
    <tr className="border-t border-slate-200">
      <th scope="row" className="p-4 text-left">
        {identity}
      </th>
      <td className="break-all p-4">{user.username}</td>
      <td className="p-4">{badge}</td>
      <td className="p-4 text-sm text-slate-600">{date}</td>
      <td className="p-4">{action}</td>
    </tr>
  );
}
UserRow.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(["admin", "user"]).isRequired,
    createdAt: PropTypes.string,
  }).isRequired,
  currentUserId: PropTypes.string,
  onDelete: PropTypes.func.isRequired,
  mobile: PropTypes.bool,
};
