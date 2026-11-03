/** Provide sticky public navigation with a small-screen disclosure menu. */
import { useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle.jsx";
import { Avatar } from "./Avatar.jsx";
import { buttonVariants, focusRing } from "./styles.js";

/** Render guest entry links or an identity's intended dashboard link.
 * Args:
 *   theme: Current light or dark presentation.
 *   onToggleTheme: Request a theme change from App.
 *   session: Optional validated identity supplied by the owning app.
 * Returns:
 *   Sticky public header; no session storage or authentication is performed.
 */
export function PublicNavbar({
  session = null,
  theme = "light",
  onToggleTheme,
}) {
  const [open, setOpen] = useState(false);
  const authenticated = session && ["admin", "user"].includes(session.role);
  const dashboard = session?.role === "admin" ? "/admin" : "/blogs";
  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <nav
        aria-label="Public navigation"
        className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6"
      >
        <Link
          to="/"
          className={`flex items-center gap-2 rounded-lg text-xl font-bold text-slate-900 dark:text-slate-100 ${focusRing}`}
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 font-serif text-white"
          >
            W
          </span>
          WriteSpace
        </Link>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="public-links"
          onClick={() => setOpen(!open)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          className={`${buttonVariants.ghost} sm:hidden`}
        >
          <span aria-hidden="true" className="mr-2 flex w-4 flex-col gap-1">
            <span className="h-0.5 w-full bg-current" />
            <span className="h-0.5 w-full bg-current" />
            <span className="h-0.5 w-full bg-current" />
          </span>
          {open ? "Close menu" : "Open menu"}
        </button>
        <div
          id="public-links"
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          className={`${open ? "flex" : "hidden"} w-full flex-col gap-3 sm:flex sm:w-auto sm:flex-row sm:items-center`}
        >
          {authenticated ? (
            <>
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <Avatar role={session.role} />
                <span className="max-w-40 truncate">{session.displayName}</span>
              </span>
              <Link
                to={dashboard}
                onClick={() => setOpen(false)}
                className={buttonVariants.primary}
              >
                Go to Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className={buttonVariants.ghost}
              >
                Login
              </Link>
              <Link
                to="/register"
                onClick={() => setOpen(false)}
                className={buttonVariants.primary}
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
PublicNavbar.propTypes = {
  theme: PropTypes.oneOf(["light", "dark"]),
  onToggleTheme: PropTypes.func,
  session: PropTypes.shape({
    role: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
  }),
};
