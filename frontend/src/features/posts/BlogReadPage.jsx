/** Display a complete local post as literal text, never interpreted markup. */
import { Link, useParams } from 'react-router-dom';
import { Avatar } from '../../shared/Avatar.jsx';
import { buttonVariants } from '../../shared/styles.js';
import { BlogCard } from './BlogCard.jsx';
import { canManagePost, formatPostDate, getAuthorRole, getPost } from './postService.js';

/** Render a selected post or a useful missing-record state.
 * Args:
 *   session: Current local identity for owner/Admin edit visibility.
 * Returns:
 *   Full plain-text reader with metadata and navigation; no mutation controls.
 */
export default function BlogReadPage({ session = null }) {
  const { id } = useParams();
  const post = getPost(id);
  return (
    <main id="main-content" className="mx-auto min-h-[70dvh] max-w-3xl px-4 py-12 sm:px-6">
      <Link to="/blogs" className={buttonVariants.ghost}>
        Back to All Posts
      </Link>
      {post ? (
        <article className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-10">
          <h1 className="break-words font-serif text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
            {post.title}
          </h1>
          <div className="mt-6 flex items-center gap-3">
            <Avatar role={getAuthorRole(post)} />
            <div className="min-w-0 text-sm">
              <p className="break-words font-semibold text-slate-800">
                {post.authorName}
              </p>
              <time dateTime={post.createdAt} className="text-slate-500">
                {formatPostDate(post.createdAt)}
              </time>
            </div>
          </div>
          {canManagePost(session, post) && (
            <Link to={`/edit/${encodeURIComponent(post.id)}`} className={`mt-6 ${buttonVariants.secondary}`}>
              Edit
            </Link>
          )}
          <div className="mt-10 whitespace-pre-wrap break-words text-lg leading-8 text-slate-800">
            {post.content}
          </div>
        </article>
      ) : (
        <h1 className="mt-10 font-serif text-4xl font-bold text-slate-900">
          Post not found
        </h1>
      )}
    </main>
  );
}
BlogReadPage.propTypes = { session: BlogCard.propTypes.session };
