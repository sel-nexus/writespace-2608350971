/** Offer one native, keyboard-operable action for the opposite presentation mode. */
import PropTypes from "prop-types";
import { buttonVariants } from "./styles.js";

/** Render a controlled action without owning storage or session state.
 * Args:
 *   theme: Current presentation supplied by App.
 *   onToggle: Request the opposite mode from the owning root.
 * Returns:
 *   A focus-visible native button whose name describes its target mode.
 */
export function ThemeToggle({ theme = "light", onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={buttonVariants.secondary}
    >
      {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    </button>
  );
}
ThemeToggle.propTypes = {
  theme: PropTypes.oneOf(["light", "dark"]),
  onToggle: PropTypes.func,
};
