/** Create and remove browser-local accounts without switching administrator identity. */
import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { createUser, deleteUser, listUsers } from "./adminService.js";
import { UserRow } from "./UserRow.jsx";
import { FormField } from "../../shared/FormField.jsx";
import { buttonVariants, focusRing } from "../../shared/styles.js";
const initialValues = { displayName: "", username: "", password: "", role: "" };

/** Render required creation fields and responsive, protected account records.
 * Args:
 *   session: Active administrator identity propagated by App.
 * Returns:
 *   Native create form, desktop table, mobile cards and associated feedback.
 */
export default function UsersPage({ session = null }) {
  const [users, setUsers] = useState([]);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  /** Reload password-free accounts and surface invalid-session errors. */
  function refresh() {
    setError("");
    try {
      setUsers(listUsers(session));
    } catch (cause) {
      setError(cause.message);
      setUsers([]);
    }
  }
  useEffect(() => {
    refresh();
  }, [session]);
  /** Preserve field identity and update the submitted native control value.
   * Args:
   *   event: Input or select change.
   */
  function change(event) {
    setValues({ ...values, [event.target.name]: event.target.value });
  }
  /** Create only validated persisted accounts, leaving the current session untouched.
   * Args:
   *   event: Native form submission.
   */
  function submit(event) {
    event.preventDefault();
    setErrors({});
    setError("");
    setStatus("");
    try {
      const account = createUser(values, session);
      setValues(initialValues);
      setStatus("Created account for " + account.displayName + ".");
      refresh();
    } catch (cause) {
      setErrors(cause.errors || {});
      setError(cause.message);
    }
  }
  /** Confirm account deletion while explicitly preserving orphan writing and author names.
   * Args:
   *   account: Account selected by a row or card.
   */
  function remove(account) {
    setError("");
    setStatus("");
    if (
      !window.confirm(
        'Delete account "' +
          account.username +
          '"? Their posts and author name will be retained.',
      )
    )
      return;
    try {
      deleteUser(account.id, session);
      setStatus("Account deleted. Their posts and author names are retained.");
      refresh();
    } catch (cause) {
      setError(cause.message);
    }
  }
  return (
    <main
      id="main-content"
      className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6"
    >
      <header className="space-y-3">
        <Link to="/admin" className={buttonVariants.ghost}>
          Back to Dashboard
        </Link>
        <h1 className="font-serif text-4xl font-bold text-slate-900 dark:text-slate-100">
          Manage Users
        </h1>
        <p className="text-slate-600 dark:text-slate-300">
          Accounts live in this browser. Deleting an account retains its posts
          and original author names.
        </p>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-700 dark:text-red-300"
        >
          {error}
        </p>
      )}
      <p role="status" className="text-sm text-slate-700 dark:text-slate-200">
        {status}
      </p>
      <section
        aria-labelledby="create-heading"
        className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6"
      >
        <h2
          id="create-heading"
          className="font-serif text-2xl font-bold text-slate-800 dark:text-slate-200"
        >
          Create User
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Local-only demo: passwords are stored in plaintext. Never use real
          passwords or sensitive data.
        </p>
        <form
          onSubmit={submit}
          noValidate
          className="mt-6 grid gap-5 sm:grid-cols-2"
        >
          <FormField
            id="admin-display-name"
            name="displayName"
            label="Display Name"
            required
            value={values.displayName}
            onChange={change}
            error={errors.displayName}
            autoComplete="off"
          />
          <FormField
            id="admin-username"
            name="username"
            label="Username"
            required
            value={values.username}
            onChange={change}
            error={errors.username}
            autoComplete="off"
          />
          <FormField
            id="admin-password"
            name="password"
            label="Password"
            type="password"
            required
            value={values.password}
            onChange={change}
            error={errors.password}
            autoComplete="new-password"
          />
          <div className="space-y-2">
            <label
              htmlFor="admin-role"
              className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
            >
              Role
            </label>
            <select
              id="admin-role"
              name="role"
              required
              aria-required="true"
              value={values.role}
              onChange={change}
              aria-invalid={Boolean(errors.role)}
              aria-describedby={errors.role ? "admin-role-error" : undefined}
              className={
                "min-h-11 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-3 py-2 " +
                focusRing
              }
            >
              <option value="">Choose a role</option>
              <option value="admin">Admin</option>
              <option value="user">user</option>
            </select>
            {errors.role && (
              <p
                id="admin-role-error"
                role="alert"
                className="text-sm text-red-600 dark:text-red-300"
              >
                {errors.role}
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className={buttonVariants.primary}>
              Create User
            </button>
          </div>
        </form>
      </section>
      <section aria-labelledby="accounts-heading" className="space-y-4">
        <h2
          id="accounts-heading"
          className="font-serif text-2xl font-bold text-slate-800 dark:text-slate-200"
        >
          Local accounts
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          The default Admin always exists. You cannot delete the account you are
          currently using.
        </p>
        {users.length > 0 ? (
          <>
            <div
              className="hidden overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 sm:block"
            >
              <table className="w-full text-left">
                <caption className="sr-only">Local accounts</caption>
                <thead className="bg-slate-100 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200">
                  <tr>
                    {[
                      "Display Name",
                      "Username",
                      "Role",
                      "Created",
                      "Actions",
                    ].map((label) => (
                      <th key={label} scope="col" className="p-4">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((account) => (
                    <UserRow
                      key={account.id}
                      user={account}
                      currentUserId={session?.userId}
                      onDelete={remove}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div aria-label="Mobile accounts" className="space-y-4 sm:hidden">
              {users.map((account) => (
                <UserRow
                  key={account.id}
                  user={account}
                  currentUserId={session?.userId}
                  onDelete={remove}
                  mobile
                />
              ))}
            </div>
            {users.length === 1 && (
              <p className="text-slate-600 dark:text-slate-300">
                No created accounts yet. Add a contributor or another Admin
                above.
              </p>
            )}
          </>
        ) : (
          <p className="text-slate-600 dark:text-slate-300">
            Accounts are unavailable. Sign in again to manage local accounts.
          </p>
        )}
      </section>
    </main>
  );
}
UsersPage.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(["admin", "user"]).isRequired,
  }),
};
