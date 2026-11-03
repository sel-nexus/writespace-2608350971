/** Keep inline utility contracts consistent; sticky navigation is the sole overlay layer. */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-slate-900";
export const buttonBase = `inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors motion-reduce:transition-none ${focusRing}`;
export const buttonVariants = {
  primary: `${buttonBase} bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 dark:bg-indigo-600 dark:text-white dark:hover:bg-indigo-700`,
  secondary: `${buttonBase} border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 dark:border-indigo-400 dark:bg-slate-900 dark:text-indigo-200 dark:hover:bg-slate-800`,
  ghost: `${buttonBase} text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800`,
};
export const roleColors = { admin: "bg-violet-600", user: "bg-indigo-500" };
