/**
 * Number Field Component
 *
 * Renders a numeric input field with min/max validation.
 */

import type { PluginConfigField } from '../../../../plugin-system/config-validator.js';
import { FieldWrapper } from './FieldWrapper.js';

/**
 * Props for NumberField
 */
interface NumberFieldProps {
  /** Field definition from schema */
  field: PluginConfigField;

  /** Current field value */
  value: unknown;

  /** Validation error message */
  error?: string | undefined;
}

/**
 * Number Field Component
 *
 * Numeric input with optional min/max range validation.
 */
export function NumberField({ field, value, error }: NumberFieldProps) {
  // Convert value to number
  const numberValue =
    typeof value === 'number'
      ? value
      : typeof field.default === 'number'
        ? field.default
        : undefined;

  return (
    <FieldWrapper
      name={field.key}
      label={field.label}
      required={field.required}
      help={field.help}
      error={error}
    >
      <input
        type="number"
        id={field.key}
        name={field.key}
        defaultValue={numberValue}
        required={field.required}
        min={field.validation?.min}
        max={field.validation?.max}
        step="any"
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
      />
    </FieldWrapper>
  );
}
