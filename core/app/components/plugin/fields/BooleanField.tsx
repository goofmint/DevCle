/**
 * Boolean Field Component
 *
 * Renders a checkbox input field for true/false values.
 */

import type { PluginConfigField } from '../../../../plugin-system/config-validator.js';
import { FieldWrapper } from './FieldWrapper.js';

/**
 * Props for BooleanField
 */
interface BooleanFieldProps {
  /** Field definition from schema */
  field: PluginConfigField;

  /** Current field value */
  value: unknown;

  /** Validation error message */
  error?: string | undefined;
}

/**
 * Boolean Field Component
 *
 * Checkbox input for boolean values.
 */
export function BooleanField({ field, value, error }: BooleanFieldProps) {
  // Convert value to boolean
  const booleanValue =
    typeof value === 'boolean'
      ? value
      : typeof field.default === 'boolean'
        ? field.default
        : false;

  return (
    <FieldWrapper
      name={field.name}
      label={field.label}
      required={field.required}
      help={field.help}
      error={error}
    >
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          id={field.name}
          name={field.name}
          defaultChecked={booleanValue}
          className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Enable {field.label.toLowerCase()}
        </span>
      </label>
    </FieldWrapper>
  );
}
