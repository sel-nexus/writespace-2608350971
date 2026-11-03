/** Render the explicitly requested role emoji avatars without fetching external images. */
import PropTypes from 'prop-types';
import { roleColors } from './styles.js';

/** Render a role chip with an accessible role name; unknown roles fail to guest.
 * Args:
 *   role: Lowercase admin or user role.
 * Returns:
 *   Static JSX avatar for the role, or a neutral guest chip.
 */
export function getAvatar(role) {
  const known = Object.hasOwn(roleColors, role);
  return (
    <span
      role="img"
      aria-label={known ? `${role === 'admin' ? 'Admin' : 'Contributor'} avatar` : 'Guest avatar'}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl ${known ? roleColors[role] : 'bg-slate-200'}`}
    >
      {known ? (role === 'admin' ? '👑' : '📖') : 'W'}
    </span>
  );
}

/** Adapt the avatar helper for component composition.
 * Args:
 *   role: Role to represent; absent roles render guest.
 * Returns:
 *   Role-distinct JSX chip.
 */
export function Avatar({ role }) {
  return getAvatar(role);
}
Avatar.propTypes = { role: PropTypes.string };
