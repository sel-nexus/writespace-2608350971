/** Own persistent local identity and the complete role-aware local publication routes. */
import { useEffect, useLayoutEffect, useState } from "react";
import {
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import LandingPage from "./features/discovery/LandingPage.jsx";
import LoginPage from "./features/auth/LoginPage.jsx";
import RegisterPage from "./features/auth/RegisterPage.jsx";
import BlogListPage from "./features/posts/BlogListPage.jsx";
import BlogReadPage from "./features/posts/BlogReadPage.jsx";
import PostFormPage from "./features/posts/PostFormPage.jsx";
import AdminPage from "./features/admin/AdminPage.jsx";
import UsersPage from "./features/admin/UsersPage.jsx";
import { getSession, clearSession } from "./features/auth/session.js";
import { ProtectedRoute } from "./shared/ProtectedRoute.jsx";
import { Navbar } from "./shared/Navbar.jsx";
import { PublicNavbar } from "./shared/PublicNavbar.jsx";
import { getTheme, saveTheme } from "./shared/theme.js";
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
      <h1 className="font-serif text-4xl font-bold text-slate-900 dark:text-slate-100">
        Page not found
      </h1>
      <p className="mt-4 text-slate-600 dark:text-slate-300">
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
 *   Discovery, auth, reading, writing, guarded administration and unknown-route feedback.
 */
export default function App() {
  const [session, setSession] = useState(getSession);
  const [theme, setTheme] = useState(getTheme);
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    saveTheme(theme);
  }, [theme]);
  /** Switch presentation independently of identity and route state. */
  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }
  const navigate = useNavigate();
  const location = useLocation();
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
    <div className="min-h-[100dvh] bg-slate-50 font-sans text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#main-content"
        className={`sr-only rounded-lg bg-white p-3 dark:bg-slate-900 focus:not-sr-only ${focusRing}`}
      >
        Skip to content
      </a>
      {location.pathname === "/" ? (
        <PublicNavbar
          session={session}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      ) : (
        <Navbar
          session={session}
          onLogout={logout}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}
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
          <Route path="/admin" element={<AdminPage session={session} />} />
          <Route path="/users" element={<UsersPage session={session} />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}
