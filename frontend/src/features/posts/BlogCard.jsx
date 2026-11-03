/** Present a plain-text post preview with an ownership-aware edit destination. */
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { Avatar } from "../../shared/Avatar.jsx";
import { buttonVariants, focusRing } from "../../shared/styles.js";
import { canManagePost, formatPostDate, getAuthorRole } from "./postService.js";

const accents = [
  "border-indigo-500 dark:border-indigo-400",
  "border-violet-500 dark:border-violet-400",
  "border-pink-500 dark:border-pink-400",
  "border-teal-500 dark:border-teal-400",
];

/** Render a navigable preview without nested links or interpreted HTML.
 * Args:
 *   post: Validated post to preview.
 *   index: Position in the newest-first grid, controlling its accent cycle.
 *   session: Current identity; card Edit is shown to Admin or the current post author.
 * Returns:
 *   Preview article with its full-reader link, metadata and optional edit link.
 */
export function BlogCard({ post, index = 0, session = null }) {
  const ownsPost = canManagePost(session, post);
  return (
    <article
      aria-label={post.title}
      className={`flex min-w-0 flex-col rounded-2xl border border-t-4 bg-white dark:bg-slate-900 p-6 shadow-sm ${accents[index % 4]}`}
    >
      <Link
        to={`/blog/${encodeURIComponent(post.id)}`}
        className={`rounded-lg ${focusRing}`}
      >
        <h2 className="break-words font-serif text-2xl font-bold text-slate-900 dark:text-slate-100">
          {post.title}
        </h2>
        <p className="mt-4 break-words text-base leading-7 text-slate-600 dark:text-slate-300">
          {post.content.slice(0, 120)}
        </p>
      </Link>
      <div className="mt-auto flex items-center gap-3 pt-6">
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
      {ownsPost && (
        <Link
          to={`/edit/${encodeURIComponent(post.id)}`}
          aria-label={`Edit ${post.title}`}
          className={`mt-4 self-start ${buttonVariants.secondary}`}
        >
          Edit
        </Link>
      )}
    </article>
  );
}
BlogCard.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    authorId: PropTypes.string.isRequired,
    authorName: PropTypes.string.isRequired,
    createdAt: PropTypes.string.isRequired,
  }).isRequired,
  index: PropTypes.number,
  session: PropTypes.shape({
    userId: PropTypes.string,
    username: PropTypes.string,
    displayName: PropTypes.string,
    role: PropTypes.string,
  }),
};
