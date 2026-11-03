/** Own persistent local identity and routes; feature destinations remain not-found until their slices. */
import { useEffect, useState } from "react";
import { Link, Route, Routes, useNavigate } from "react-router-dom";
import LandingPage from "./features/discovery/LandingPage.jsx";
import LoginPage from "./features/auth/LoginPage.jsx";
import RegisterPage from "./features/auth/RegisterPage.jsx";
import BlogListPage from "./features/posts/BlogListPage.jsx";
import BlogReadPage from "./features/posts/BlogReadPage.jsx";
import PostFormPage from "./features/posts/PostFormPage.jsx";
import { getSession, clearSession } from "./features/auth/session.js";
import { ProtectedRoute } from "./shared/ProtectedRoute.jsx";
import { Navbar } from "./shared/Navbar.jsx";
import { buttonVariants, focusRing } from "./shared/styles.js";

/** Render a useful not-found state without pretending intended routes exist.
 * Returns:
 *   Missing-page message and a working landing-page back link.
 */
function NotFound() {
  return (
    <main
      id="main-content"
      className="mx-auto min-h-[70dvh] max-w-6xl px-4 py-24 sm:px-6"
    >
      <h1 className="font-serif text-4xl font-bold text-slate-900">
        Page not found
      </h1>
      <p className="mt-4 text-slate-600">
        This address is not available. Return to WriteSpace to explore the local
        publication.
      </p>
      <Link to="/" className={`mt-8 ${buttonVariants.primary}`}>
        Back to Home
      </Link>
    </main>
  );
}

/** Own session state, synchronize external storage changes and compose role-aware routes.
 * Returns:
 *   Discovery, auth, reading, writing, guarded admin fallbacks and unknown-route feedback.
 */
export default function App() {
  const [session, setSession] = useState(getSession);
  const navigate = useNavigate();
  useEffect(() => {
    /** Revalidate identity after another tab changes users or session storage. */
    function synchronize() {
      setSession(getSession());
    }
    window.addEventListener("storage", synchronize);
    window.addEventListener("focus", synchronize);
    return () => {
      window.removeEventListener("storage", synchronize);
      window.removeEventListener("focus", synchronize);
    };
  }, []);
  /** Clear persistence before changing visible identity or navigating home.
   * Raises:
   *   Error: Failed logout is displayed by Navbar, preserving the current shell.
   */
  function logout() {
    clearSession();
    setSession(null);
    navigate("/", { replace: true });
  }
  return (
    <div className="min-h-[100dvh] bg-slate-50 font-sans text-slate-800">
      <a
        href="#main-content"
        className={`sr-only rounded-lg bg-white p-3 focus:not-sr-only ${focusRing}`}
      >
        Skip to content
      </a>
      <Navbar session={session} onLogout={logout} />
      <Routes>
        <Route path="/" element={<LandingPage session={session} />} />
        <Route
          path="/login"
          element={<LoginPage session={session} onAuthenticated={setSession} />}
        />
        <Route
          path="/register"
          element={
            <RegisterPage session={session} onAuthenticated={setSession} />
          }
        />
        <Route element={<ProtectedRoute session={session} />}>
          <Route path="/blogs" element={<BlogListPage session={session} />} />
          <Route
            path="/blog/:id"
            element={<BlogReadPage session={session} />}
          />
          <Route
            path="/write"
            element={<PostFormPage key="write" session={session} />}
          />
          <Route
            path="/edit/:id"
            element={<PostFormPage key="edit" session={session} />}
          />
          <Route
            path="/edit"
            element={<PostFormPage key="missing-edit" session={session} />}
          />
        </Route>
        <Route element={<ProtectedRoute session={session} roles={["admin"]} />}>
          <Route path="/admin" element={<NotFound />} />
          <Route path="/users" element={<NotFound />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}
