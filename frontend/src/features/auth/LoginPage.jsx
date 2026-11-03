/** Present login for the plaintext browser-local demo. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { FormField } from '../../shared/FormField.jsx';
import { buttonVariants, focusRing } from '../../shared/styles.js';
import { login, roleHome } from './authService.js';

/** Render accessible entry fields and report validation or storage failures.
 * Args:
 *   session: Current validated identity; existing identities redirect home.
 *   onAuthenticated: Notify App only after a successful persisted session.
 * Returns:
 *   Local-demo form or role-home redirect.
 */
export default function LoginPage({ session = null, onAuthenticated }) {
  const navigate = useNavigate();
  const [values, setValues] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  if (session) return <Navigate to={roleHome(session)} replace />;

  /** Validate and persist before updating the owning App or navigating.
   * Args:
   *   event: Native form submission to prevent.
   */
  function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    const nextErrors = {};
    if (!values.username.trim()) nextErrors.username = 'Username is required.';
    if (!values.password.trim()) nextErrors.password = 'Password is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      event.currentTarget.querySelector('[name="' + Object.keys(nextErrors)[0] + '"]').focus();
      return;
    }
    setSubmitting(true);
    try {
      const identity = login(values.username, values.password);
      onAuthenticated(identity);
      navigate(roleHome(identity), { replace: true });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-6xl items-center justify-center px-4 py-12 sm:px-6"
    >
      <section
        aria-labelledby="auth-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8"
      >
        <Link
          to="/"
          className={`inline-flex rounded-lg text-lg font-bold text-indigo-700 ${focusRing}`}
        >
          WriteSpace
        </Link>
        <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Your browser. Your space.
        </p>
        <h1 id="auth-title" className="mt-2 font-serif text-3xl font-bold text-slate-900">
          Welcome back
        </h1>
        <p className="mt-3 leading-relaxed text-slate-600">
          Login to return to your local writing demo.
        </p>
        <p className="mt-5 rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-600">
          Local-only demo: passwords are stored in plaintext in this browser. Never use real
          passwords or sensitive data. This is not secure authentication.
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Built-in demo credentials: username <strong>admin</strong> / password{' '}
          <strong>admin</strong>.
        </p>
        <form noValidate onSubmit={handleSubmit} className="mt-6 space-y-5">
          <FormField
            id="login-username"
            name="username"
            label="Username"
            type="text"
            autoComplete="username"
            required
            value={values.username}
            error={errors.username}
            onChange={(event) => setValues({ ...values, username: event.target.value })}
          />
          <FormField
            id="login-password"
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={values.password}
            error={errors.password}
            onChange={(event) => setValues({ ...values, password: event.target.value })}
          />
          {message && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full disabled:opacity-60 ${buttonVariants.primary}`}
          >
            {submitting ? 'Saving…' : 'Login'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          New to WriteSpace?{' '}
          <Link
            to="/register"
            className={`rounded font-semibold text-indigo-700 underline underline-offset-4 ${focusRing}`}
          >
            Register
          </Link>
        </p>
      </section>
    </main>
  );
}
LoginPage.propTypes = {
  session: PropTypes.shape({ role: PropTypes.oneOf(['admin', 'user']).isRequired }),
  onAuthenticated: PropTypes.func.isRequired,
};
