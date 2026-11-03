/** Own only the discovery route; subsequent slices add their real pages here. */
import { Link, Route, Routes } from 'react-router-dom';
import LandingPage from './features/discovery/LandingPage.jsx';
import { Navbar } from './shared/Navbar.jsx';
import { buttonVariants, focusRing } from './shared/styles.js';

/** Render a useful not-found state without pretending intended routes exist.
 * Returns:
 *   Missing-page message and a working landing-page back link.
 */
function NotFound() {
  return (
    <main id="main-content" className="mx-auto min-h-[70dvh] max-w-6xl px-4 py-24 sm:px-6">
      <h1 className="font-serif text-4xl font-bold text-slate-900">
        Page not found
      </h1>
      <p className="mt-4 text-slate-600">
        This address is not available. Return to WriteSpace to explore the local publication.
      </p>
      <Link to="/" className={`mt-8 ${buttonVariants.primary}`}>
        Back to Home
      </Link>
    </main>
  );
}

/** Compose the public shell without reading sessions or adding an extra router.
 * Returns:
 *   The landing route and a wildcard fallback.
 */
export default function App() {
  return (
    <div className="min-h-[100dvh] bg-slate-50 font-sans text-slate-800">
      <a href="#main-content" className={`sr-only rounded-lg bg-white p-3 focus:not-sr-only ${focusRing}`}>
        Skip to content
      </a>
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}
