/** Present real browser-local activity and account totals, never invented analytics. */
import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { StatCard } from "./StatCard.jsx";
import { getDashboard, deleteRecentPost } from "./adminService.js";
import { formatPostDate } from "../posts/postService.js";
import { buttonBase, buttonVariants } from "../../shared/styles.js";

/** Render the administrator overview and confirmed recent-post actions.
 * Args:
 *   session: Active administrator identity propagated by App.
 * Returns:
 *   Dashboard, meaningful no-post state and visible operation errors.
 */
export default function AdminPage({ session = null }) {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  /** Refresh counts and activity, retaining visible failures rather than false data. */
  function refresh() {
    setError("");
    try {
      setDashboard(getDashboard(session));
    } catch (cause) {
      setDashboard(null);
      setError(cause.message);
    }
  }
  useEffect(() => {
    refresh();
  }, [session]);
  /** Confirm destruction, revalidate active identity and refresh the real metrics.
   * Args:
   *   post: Recent post chosen for removal.
   */
  function remove(post) {
    setError("");
    setStatus("");
    if (!window.confirm('Delete "' + post.title + '"? This cannot be undone.')) return;
    try {
      deleteRecentPost(post.id, session);
      setStatus("Post deleted.");
      refresh();
    } catch (cause) {
      setError(cause.message);
    }
  }
  return (
    <main id="main-content" className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <header className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-widest">
          Local publication overview
        </p>
        <h1 className="mt-3 font-serif text-4xl font-bold">Admin Dashboard</h1>
        <p className="mt-3 max-w-2xl">
          A little oversight for your writing space. Manage posts and accounts in this browser only.
        </p>
      </header>
      {error && (
        <div className="space-y-3 rounded-lg bg-red-50 p-4">
          <p role="alert" className="text-red-700">
            {error}
          </p>
          <button type="button" onClick={refresh} className={buttonVariants.secondary}>
            Retry overview
          </button>
        </div>
      )}
      <p role="status" className="text-sm text-slate-700">
        {status}
      </p>
      {dashboard && (
        <section
          aria-label="Publication statistics"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <StatCard label="Total Posts" value={dashboard.totalPosts} accent="indigo" />
          <StatCard label="Total Users" value={dashboard.totalUsers} accent="slate" />
          <StatCard label="Total Admins" value={dashboard.totalAdmins} accent="violet" />
          <StatCard label="Total contributors" value={dashboard.totalContributors} accent="teal" />
        </section>
      )}
      <nav aria-label="Quick actions" className="flex flex-wrap gap-3">
        <Link to="/write" className={buttonVariants.primary}>
          Write New Post
        </Link>
        <Link to="/users" className={buttonVariants.secondary}>
          Manage Users
        </Link>
      </nav>
      {dashboard && (
        <section
          aria-labelledby="recent-heading"
          className="rounded-2xl border border-slate-200 bg-white p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="recent-heading" className="font-serif text-2xl font-bold">
              Recent posts
            </h2>
            <Link to="/blogs" className={buttonVariants.ghost}>
              All Blogs
            </Link>
          </div>
          {dashboard.recentPosts.length === 0 ? (
            <p className="py-8 text-slate-600">
              No posts yet. Write your first post to start this local publication.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-200">
              {dashboard.recentPosts.map((post) => (
                <li
                  key={post.id}
                  className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <h3 className="break-words text-lg font-semibold">
                      <Link to={"/blog/" + post.id} className={buttonVariants.ghost}>
                        {post.title}
                      </Link>
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {post.authorName} ·{" "}
                      <time dateTime={post.createdAt}>{formatPostDate(post.createdAt)}</time>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      to={"/edit/" + post.id}
                      aria-label={"Edit " + post.title}
                      className={buttonVariants.secondary}
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      aria-label={"Delete " + post.title}
                      onClick={() => remove(post)}
                      className={
                        buttonBase +
                        " border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                      }
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <p className="text-sm text-slate-600">
        Client-side roles are demo behavior, not secure authorization. Data is not shared across
        browsers.
      </p>
    </main>
  );
}
AdminPage.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(["admin", "user"]).isRequired,
  }),
};
