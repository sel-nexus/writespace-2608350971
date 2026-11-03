/** Persist an optional raw preference independently of local identity. */
export const THEME_KEY = "writespace_theme";

/** Read only a supported preference, falling back safely without system-theme inference.
 * Returns:
 *   Light or dark; missing, malformed or unavailable storage defaults to light.
 */
export function getTheme() {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    return theme === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** Save a supported raw preference without interrupting the current presentation.
 * Args:
 *   theme: Requested light or dark mode; all other values are rejected.
 * Returns:
 *   Whether storage accepted the write; failure leaves the in-memory choice usable.
 */
export function saveTheme(theme) {
  if (theme !== "light" && theme !== "dark") return false;
  try {
    localStorage.setItem(THEME_KEY, theme);
    return true;
  } catch {
    return false;
  }
}
