/** Compose literal browser-local writing with visible persistence errors. */
import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { isValidSession } from "../auth/session.js";
import { FormField } from "../../shared/FormField.jsx";
import { buttonVariants } from "../../shared/styles.js";
import {
  canManagePost,
  createPost,
  getPost,
  updatePost,
} from "./postService.js";

/** Render create/edit fields and deterministic Cancel navigation.
 * Args:
 *   session: Complete identity revalidated by each mutation.
 * Returns:
 *   Plain-text form, missing-post feedback, or ownership-denial redirect.
 */
export default function PostFormPage({ session = null }) {
  const { id } = useParams();
  const location = useLocation();
  const editing = location.pathname.startsWith("/edit");
  const post = editing ? getPost(id) : null;
  const navigate = useNavigate();
  const [title, setTitle] = useState(post?.title ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  useEffect(() => {
    const current = editing ? getPost(id) : null;
    setTitle(current?.title ?? "");
    setContent(current?.content ?? "");
    setErrors({});
    setError("");
  }, [id, editing]);

  /** Save through the service and navigate only after persistence.
   * Args:
   *   event: Native form submission to prevent.
   */
  function save(event) {
    event.preventDefault();
    setErrors({});
    setError("");
    try {
      const values = { title, content };
      const saved = editing
        ? updatePost(id, values, session)
        : createPost(values, session);
      navigate("/blog/" + encodeURIComponent(saved.id));
    } catch (cause) {
      setErrors(cause.errors ?? {});
      setError(cause.errors ? "" : cause.message);
    }
  }

  if (
    editing &&
    post &&
    isValidSession(session) &&
    !canManagePost(session, post)
  )
    return <Navigate to="/blogs" replace />;
  return (
    <main
      id="main-content"
      className="mx-auto min-h-[70dvh] max-w-3xl px-4 py-12 sm:px-6"
    >
      {editing && !post ? (
        <>
          <h1 className="font-serif text-4xl font-bold text-slate-900">
            Post not found
          </h1>
          <Link to="/blogs" className={buttonVariants.ghost}>
            Back to All Posts
          </Link>
        </>
      ) : (
        <>
          <h1 className="font-serif text-4xl font-bold text-slate-900">
            {editing ? "Edit Post" : "Write a Post"}
          </h1>
          <p className="mt-3 text-slate-600">
            Your words are saved as plain text in this browser.
          </p>
          <form
            noValidate
            onSubmit={save}
            className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-10"
          >
            <FormField
              id="post-title"
              label="Title"
              required
              value={title}
              error={errors.title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <FormField
              id="post-content"
              label="Content"
              multiline
              required
              value={content}
              error={errors.content}
              hint={content.length + " characters"}
              onChange={(event) => setContent(event.target.value)}
            />
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-600"
              >
                {error}
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="submit" className={buttonVariants.primary}>
                Save
              </button>
              <Link
                to={editing ? "/blog/" + encodeURIComponent(id) : "/blogs"}
                className={buttonVariants.ghost}
              >
                Cancel
              </Link>
            </div>
          </form>
        </>
      )}
    </main>
  );
}
PostFormPage.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string,
    username: PropTypes.string,
    displayName: PropTypes.string,
    role: PropTypes.string,
  }),
};
