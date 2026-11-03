/** Keep the current app's navigation public; authenticated shell belongs to the auth slice. */
import { PublicNavbar } from './PublicNavbar.jsx';

/** Compose the public shell using identity props, without a session service.
 * Args:
 *   session: Optional identity from the owner.
 * Returns:
 *   Public navigation.
 */
export function Navbar({ session = null }) {
  return <PublicNavbar session={session} />;
}
Navbar.propTypes = PublicNavbar.propTypes;
