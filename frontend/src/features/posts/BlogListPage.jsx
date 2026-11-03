/** Provide the authenticated reading entry point for browser-local posts. */
import { Link } from "react-router-dom";
import { BlogCard } from "./BlogCard.jsx";
import { getPosts } from "./postService.js";
import { buttonVariants } from "../../shared/styles.js";

/** Render newest-first writing or an actionable empty state.
 * Args:
 *   session: Current identity passed to each ownership-aware preview.
 * Returns:
 *   Responsive post grid or the specified empty copy and Write destination.
 */
export default function BlogListPage({ session = null }) {
  const posts = getPosts();
  return (
    <main
      id="main-content"
      className="mx-auto min-h-[70dvh] max-w-6xl px-4 py-12 sm:px-6"
    >
      <header className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-700 dark:text-indigo-300">
          The local publication
        </p>
        <h1 className="mt-3 font-serif text-4xl font-bold text-slate-900 dark:text-slate-100 sm:text-5xl">
          All Blogs
        </h1>
      </header>
      {posts.length ? (
        <section
          aria-label="Blog posts"
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {posts.map((post, index) => (
            <BlogCard
              key={post.id}
              post={post}
              index={index}
              session={session}
            />
          ))}
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-16 text-center">
          <p className="font-serif text-2xl font-semibold text-slate-800 dark:text-slate-200">
            No blogs yet. Be the first to write one!
          </p>
          <Link to="/write" className={`mt-6 ${buttonVariants.primary}`}>
            Write
          </Link>
        </section>
      )}
    </main>
  );
}
BlogListPage.propTypes = { session: BlogCard.propTypes.session };
