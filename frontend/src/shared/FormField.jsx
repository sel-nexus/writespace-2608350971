/** Associate labels, optional hints and validation with a native form control. */
import PropTypes from 'prop-types';
import { focusRing } from './styles.js';

/** Render an accessible field without owning form or submission state.
 * Args:
 *   id, label: Stable control identity and visible label.
 *   error, hint: Optional validation and supporting instructions.
 *   multiline: Select textarea instead of input.
 *   required: Mark the native field and its accessible required state.
 *   inputProps: Native input properties and event callbacks.
 * Returns:
 *   Labeled native field with associated feedback.
 */
export function FormField({ id, label, error, hint, multiline = false, required = false, ...inputProps }) {
  const Control = multiline ? 'textarea' : 'input';
  const description = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
        {label}
      </label>
      <Control
        {...inputProps}
        id={id}
        required={required}
        aria-required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={description}
        className={[
          'w-full rounded-lg border bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200',
          focusRing,
          error ? 'border-red-600 dark:border-red-400' : 'border-slate-300 dark:border-slate-600',
          multiline ? 'min-h-64' : 'min-h-11',
        ].join(' ')}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-slate-600 dark:text-slate-300">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
FormField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  error: PropTypes.string,
  hint: PropTypes.string,
  multiline: PropTypes.bool,
  required: PropTypes.bool,
};
