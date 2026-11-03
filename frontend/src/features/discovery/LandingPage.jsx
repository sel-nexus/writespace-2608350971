/** Introduce the browser-local publication and preview real locally saved writing. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { getPosts } from '../posts/storage.js';
import { buttonVariants, focusRing } from '../../shared/styles.js';

/** Render a plain-text preview shared by the hero and recent writing section.
 * Args:
 *   post: Saved post; absence renders the genuine empty preview.
 *   headingLevel: Heading appropriate to the surrounding section.
 * Returns:
 *   A real discovery card without invented seed content.
 */
function PreviewCard({ post, headingLevel = 'h3' }) {
  const Heading = headingLevel;
  if (!post) {
    return (
      <article className="rounded-2xl border border-slate-200 dark:border-slate-700 border-t-4 border-t-teal-500 dark:border-t-teal-400 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <Heading className="font-serif text-2xl font-bold text-slate-900 dark:text-slate-100">
          A space for your writing
        </Heading>
        <p className="mt-4 leading-relaxed text-slate-600 dark:text-slate-300">
          Your latest local post will appear here. Start with a thought, a story, or something worth remembering.
        </p>
        <Link to="/register" className={`mt-6 inline-flex min-h-11 items-center rounded-lg font-semibold text-indigo-700 dark:text-indigo-300 ${focusRing}`}>
          Get Started Free
        </Link>
      </article>
    );
  }
  const date = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(post.createdAt));
  return (
    <article className="h-full min-w-0 rounded-2xl border border-slate-200 dark:border-slate-700 border-t-4 border-t-teal-500 dark:border-t-teal-400 bg-white dark:bg-slate-900 shadow-sm">
      <Link
        to={`/blog/${encodeURIComponent(post.id)}`}
        className={`block h-full rounded-2xl p-6 transition-shadow hover:shadow-md motion-reduce:transition-none ${focusRing}`}
      >
        <time dateTime={post.createdAt} className="text-sm text-slate-600 dark:text-slate-300">
          {date}
        </time>
        <Heading className="mt-3 break-words font-serif text-2xl font-bold leading-tight text-slate-900 dark:text-slate-100">
          {post.title}
        </Heading>
        <p className="mt-4 break-words leading-relaxed text-slate-600 dark:text-slate-300">
          {post.content.slice(0, 120)}{post.content.length > 120 ? '…' : ''}
        </p>
        <span className="mt-6 inline-block font-semibold text-indigo-700 dark:text-indigo-300">
          Read post
        </span>
      </Link>
    </article>
  );
}
PreviewCard.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    createdAt: PropTypes.string.isRequired,
  }),
  headingLevel: PropTypes.oneOf(['h2', 'h3']),
};

const features = [
  { title: 'Write Freely', text: 'Plain-text writing without distractions. Make room for the words that matter.', style: 'bg-indigo-50 dark:bg-indigo-950 border-indigo-100 dark:border-indigo-800', accent: 'text-indigo-700 dark:text-indigo-300' },
  { title: 'Private & Local', text: 'Your demo data lives in this browser. No shared server, no cross-device synchronization.', style: 'bg-teal-50 dark:bg-teal-950 border-teal-100 dark:border-teal-800', accent: 'text-teal-800 dark:text-teal-300' },
  { title: 'Instant & Fast', text: 'A lightweight static experience. No server to wait for and no complicated setup.', style: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700', accent: 'text-slate-800 dark:text-slate-200' },
];

/** Render discovery using persisted posts and optional identity props.
 * Args:
 *   session: Optional validated identity; guests are the default.
 * Returns:
 *   Hero, benefits, three newest previews and local-only footer.
 */
export default function LandingPage({ session = null }) {
  const [posts] = useState(() => getPosts().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 3));
  const authenticated = session && ['admin', 'user'].includes(session.role);
  return (
    <>
      <main id="main-content">
        <section
          aria-labelledby="hero-title"
          className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:gap-16"
        >
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-800 dark:text-teal-300">
              A browser-local publication
            </p>
            <h1 id="hero-title" className="mt-5 font-serif text-[clamp(3rem,7vw,5.5rem)] font-bold leading-[1.1] tracking-tight text-slate-900 dark:text-slate-100">
              WriteSpace
            </h1>
            <p className="mt-6 max-w-md text-xl leading-relaxed text-slate-600 dark:text-slate-300 sm:text-2xl">
              Your thoughts. Your space. Beautifully simple.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={authenticated ? '/blogs' : '/login'} className={buttonVariants.secondary}>
                Start Reading
              </Link>
              <Link to="/register" className={buttonVariants.primary}>
                Get Started Free
              </Link>
            </div>
          </div>
          <div className="min-w-0 rounded-2xl bg-teal-800 dark:bg-teal-900 p-6 shadow-xl shadow-teal-900/10 sm:p-10">
            <p className="mb-6 font-serif text-2xl font-semibold text-white">
              Good writing starts with space.
            </p>
            <style>{`
              @keyframes writespace-float {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-8px); }
              }
              @media (prefers-reduced-motion: no-preference) {
                .writespace-floating-card { animation: writespace-float 6s ease-in-out infinite; }
              }
            `}</style>
            <div className="writespace-floating-card">
              <PreviewCard post={posts[0]} headingLevel="h2" />
            </div>
          </div>
        </section>
        <section aria-labelledby="features-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="features-title" className="font-serif text-3xl font-bold text-slate-900 dark:text-slate-100">
            Less setup. More expression.
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.title} className={`rounded-2xl border p-6 ${feature.style}`}>
                <h3 className={`text-xl font-bold ${feature.accent}`}>
                  {feature.title}
                </h3>
                <p className="mt-4 leading-relaxed text-slate-600 dark:text-slate-300">
                  {feature.text}
                </p>
              </article>
            ))}
          </div>
        </section>
        <section aria-labelledby="latest-title" className="mx-auto max-w-6xl px-4 pb-24 pt-12 sm:px-6">
          <h2 id="latest-title" className="font-serif text-3xl font-bold text-slate-900 dark:text-slate-100">
            Latest from the Blog
          </h2>
          {posts.length ? (
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <PreviewCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-8">
              <p className="text-lg font-medium text-slate-700 dark:text-slate-200">
                No posts yet — check back soon!
              </p>
              <p className="mt-2 text-slate-600 dark:text-slate-300">
                This browser has no saved writing yet.
              </p>
            </div>
          )}
        </section>
      </main>
      <footer className="bg-slate-900 dark:bg-slate-950 px-4 py-12 text-slate-200 dark:text-slate-300 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-6">
            {[['Home', '/'], ['All Blogs', '/blogs'], ['Login', '/login'], ['Register', '/register']].map(([label, path]) => (
              <Link key={path} to={path} className={`inline-flex min-h-11 items-center rounded-lg hover:text-white dark:hover:text-white ${focusRing}`}>
                {label}
              </Link>
            ))}
          </nav>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed">
            Local-only demo. Data stays in this browser and is not shared or backed up. Demo passwords are plaintext; never use real passwords or sensitive data.
          </p>
          <p className="mt-4 text-sm">
            © {new Date().getFullYear()} WriteSpace
          </p>
        </div>
      </footer>
    </>
  );
}
LandingPage.propTypes = {
  session: PropTypes.shape({ role: PropTypes.string.isRequired }),
};
