/** Enforce local demo route access, not server-side authorization. */
import PropTypes from 'prop-types';
import { Navigate, Outlet } from 'react-router-dom';
import { isValidSession } from '../features/auth/session.js';

/** Fail closed for guests/invalid identities and route wrong roles to the blog.
 * Args:
 *   session: Untrusted or validated local identity; revalidated against current users.
 *   roles: Allowed lowercase roles, defaulting to both supported roles.
 *   children: Optional wrapped content; otherwise render nested routes.
 * Returns:
 *   Permitted content or a replacement redirect.
 */
export function ProtectedRoute({ session = null, roles = ['admin', 'user'], children }) {
  if (!isValidSession(session)) return <Navigate to="/login" replace />;
  if (!roles.includes(session.role)) return <Navigate to="/blogs" replace />;
  return children ?? <Outlet />;
}
ProtectedRoute.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string,
    username: PropTypes.string,
    displayName: PropTypes.string,
    role: PropTypes.string,
  }),
  roles: PropTypes.arrayOf(PropTypes.oneOf(['admin', 'user'])),
  children: PropTypes.node,
};
