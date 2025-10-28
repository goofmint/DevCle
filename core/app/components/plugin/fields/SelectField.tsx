/**
 * Select Field Component
 *
 * Renders a dropdown select field with predefined options.
 */

import type { PluginConfigField } from '../../../../plugin-system/config-validator.js';
import { FieldWrapper } from './FieldWrapper.js';

/**
 * Props for SelectField
 */
interface SelectFieldProps {
  /** Field definition from schema */
  field: PluginConfigField;

  /** Current field value */
  value: unknown;

  /** Validation error message */
  error?: string | undefined;
}

/**
 * Select Field Component
 *
 * Dropdown select with predefined options.
 */
export function SelectField({ field, value, error }: SelectFieldProps) {
  // Get current value or default
  const currentValue =
    value !== undefined && value !== null
      ? String(value)
      : field.default !== undefined
        ? String(field.default)
        : '';

  // Options must be defined for select fields
  if (!field.options || field.options.length === 0) {
    console.error(`Select field ${field.name} has no options`);
    return null;
  }

  return (
    <FieldWrapper
      name={field.name}
      label={field.label}
      required={field.required}
      help={field.help}
      error={error}
    >
      <select
        id={field.name}
        name={field.name}
        defaultValue={currentValue}
        required={field.required}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
      >
        {/* Empty option for non-required fields */}
        {!field.required && (
          <option value="">-- Select {field.label} --</option>
        )}

        {/* Options from schema */}
        {field.options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}
