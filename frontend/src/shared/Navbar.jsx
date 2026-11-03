/** Provide native role navigation and identity disclosures for the local demo. */
import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Link, NavLink, useLocation } from "react-router-dom";
import { PublicNavbar } from "./PublicNavbar.jsx";
import { ThemeToggle } from "./ThemeToggle.jsx";
import { Avatar } from "./Avatar.jsx";
import { buttonVariants, focusRing } from "./styles.js";

/** Render guest navigation or an authenticated shell with accessible disclosures.
 * Args:
 *   theme: Current light or dark presentation.
 *   onToggleTheme: Request a theme change from App.
 *   session: Validated local identity supplied by App.
 *   onLogout: Clear persistence and route home; failures remain visible here.
 * Returns:
 *   Sticky navigation with native links/buttons, mobile toggle and Logout dropdown.
 */
export function Navbar({
  session = null,
  onLogout,
  theme = "light",
  onToggleTheme,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState("");
  const mobileTrigger = useRef(null);
  const accountTrigger = useRef(null);
  const logoutButton = useRef(null);
  const header = useRef(null);
  const location = useLocation();
  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
    setError("");
  }, [location.pathname]);
  useEffect(() => {
    if (accountOpen) logoutButton.current?.focus();
  }, [accountOpen]);
  useEffect(() => {
    /** Dismiss disclosures when clicking outside the header.
     * Args:
     *   event: Pointer action to inspect.
     */
    function dismiss(event) {
      if (!header.current?.contains(event.target)) {
        setMobileOpen(false);
        setAccountOpen(false);
      }
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  if (!session)
    return <PublicNavbar theme={theme} onToggleTheme={onToggleTheme} />;
  const links = [
    { to: "/blogs", label: "All Blogs" },
    { to: "/write", label: "Write" },
  ];
  if (session.role === "admin") links.push({ to: "/users", label: "Users" });

  /** Close the innermost disclosure and return keyboard focus to its trigger.
   * Args:
   *   event: Bubbled keyboard action.
   */
  function handleEscape(event) {
    if (event.key !== "Escape") return;
    if (accountOpen) {
      setAccountOpen(false);
      accountTrigger.current?.focus();
    } else if (mobileOpen) {
      setMobileOpen(false);
      mobileTrigger.current?.focus();
    }
  }

  /** Delegate logout and retain the current shell on persistence failure. */
  function handleLogout() {
    try {
      onLogout();
    } catch (cause) {
      setError(cause.message);
    }
  }

  return (
    <header
      ref={header}
      onKeyDown={handleEscape}
      className="sticky top-0 z-20 border-b border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <nav
        aria-label="Authenticated navigation"
        className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6"
      >
        <Link
          to="/"
          className={`rounded-lg text-xl font-bold text-slate-900 dark:text-slate-100 ${focusRing}`}
        >
          WriteSpace
        </Link>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <button
          ref={mobileTrigger}
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="authenticated-links"
          onClick={() => setMobileOpen(!mobileOpen)}
          className={`${buttonVariants.ghost} sm:hidden`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="mr-2 h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          {mobileOpen ? "Close menu" : "Open menu"}
        </button>
        <div
          id="authenticated-links"
          className={`${mobileOpen ? "flex" : "hidden"} w-full flex-col gap-2 sm:flex sm:w-auto sm:flex-row`}
        >
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `${buttonVariants.ghost} rounded-full ${isActive ? "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-600 dark:text-white dark:hover:bg-indigo-700" : ""}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
        <div
          className="relative"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setAccountOpen(false);
          }}
        >
          <button
            ref={accountTrigger}
            type="button"
            aria-label={session.displayName + " account"}
            aria-expanded={accountOpen}
            aria-controls="account-actions"
            onClick={() => setAccountOpen(!accountOpen)}
            className={`flex min-h-11 items-center gap-2 rounded-lg p-1 text-sm font-semibold text-slate-700 dark:text-slate-200 ${focusRing}`}
          >
            <Avatar role={session.role} />
            <span className="max-w-40 truncate">{session.displayName}</span>
            <span className="sr-only">account</span>
          </button>
          {accountOpen && (
            <div
              id="account-actions"
              className="absolute right-0 mt-2 min-w-40 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900"
            >
              <button
                ref={logoutButton}
                type="button"
                onClick={handleLogout}
                className={`w-full ${buttonVariants.ghost}`}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </nav>
      {error && (
        <p
          role="alert"
          className="mx-auto max-w-6xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      )}
    </header>
  );
}
Navbar.propTypes = {
  theme: PropTypes.oneOf(["light", "dark"]),
  onToggleTheme: PropTypes.func,
  session: PropTypes.shape({
    role: PropTypes.oneOf(["admin", "user"]).isRequired,
    displayName: PropTypes.string.isRequired,
  }),
  onLogout: PropTypes.func,
};
