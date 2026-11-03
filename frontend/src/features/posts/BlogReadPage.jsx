/** Display a complete local post as literal text, never interpreted markup. */
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Avatar } from "../../shared/Avatar.jsx";
import { buttonBase, buttonVariants } from "../../shared/styles.js";
import { BlogCard } from "./BlogCard.jsx";
import {
  canManagePost,
  deletePost,
  formatPostDate,
  getAuthorRole,
  getPost,
} from "./postService.js";

/** Render a selected post or a useful missing-record state.
 * Args:
 *   session: Current local identity for owner/Admin edit visibility.
 * Returns:
 *   Full plain-text reader with ownership-aware confirmed deletion and navigation.
 */
export default function BlogReadPage({ session = null }) {
  const { id } = useParams();
  const post = getPost(id);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  /** Confirm removal and retain the reader with visible feedback on failure. */
  function remove() {
    setError("");
    try {
      if (!window.confirm("Delete this post? This cannot be undone.")) return;
      deletePost(id, session);
      navigate("/blogs");
    } catch (cause) {
      setError(cause.message);
    }
  }
  return (
    <main
      id="main-content"
      className="mx-auto min-h-[70dvh] max-w-3xl px-4 py-12 sm:px-6"
    >
      <Link to="/blogs" className={buttonVariants.ghost}>
        Back to All Posts
      </Link>
      {error && (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-red-50 dark:bg-red-950 p-3 text-sm text-red-600 dark:text-red-300"
        >
          {error}
        </p>
      )}
      {post ? (
        <article className="mt-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-10">
          <h1 className="break-words font-serif text-4xl font-bold leading-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
            {post.title}
          </h1>
          <div className="mt-6 flex items-center gap-3">
            <Avatar role={getAuthorRole(post)} />
            <div className="min-w-0 text-sm">
              <p className="break-words font-semibold text-slate-800 dark:text-slate-200">
                {post.authorName}
              </p>
              <time
                dateTime={post.createdAt}
                className="text-slate-500 dark:text-slate-400"
              >
                {formatPostDate(post.createdAt)}
              </time>
            </div>
          </div>
          {canManagePost(session, post) && (
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to={"/edit/" + encodeURIComponent(post.id)}
                className={buttonVariants.secondary}
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={remove}
                className={
                  buttonBase +
                  " border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900"
                }
              >
                Delete
              </button>
            </div>
          )}
          <div className="mt-10 whitespace-pre-wrap break-words text-lg leading-8 text-slate-800 dark:text-slate-200">
            {post.content}
          </div>
        </article>
      ) : (
        <h1 className="mt-10 font-serif text-4xl font-bold text-slate-900 dark:text-slate-100">
          Post not found
        </h1>
      )}
    </main>
  );
}
BlogReadPage.propTypes = { session: BlogCard.propTypes.session };
