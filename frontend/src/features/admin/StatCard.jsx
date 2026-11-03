/** Display one real local metric with an accessible label and tabular value. */
import PropTypes from "prop-types";
const accents = {
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-800",
  violet: "border-violet-200 bg-violet-50 text-violet-800",
  teal: "border-teal-200 bg-teal-50 text-teal-800",
  slate: "border-slate-200 bg-white text-slate-800",
};
/** Render a metric, including a meaningful zero.
 * Args:
 *   label: Visible count meaning.
 *   value: Actual count from the admin service.
 *   accent: Compatible brand surface variant.
 * Returns:
 *   Named statistic group.
 */
export function StatCard({ label, value, accent = "slate" }) {
  return (
    <div role="group" aria-label={label} className={"rounded-2xl border p-5 " + accents[accent]}>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-3 text-4xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  accent: PropTypes.oneOf(Object.keys(accents)),
};
