/**
 * String Field Component
 *
 * Renders a single-line text input field.
 * Supports string, url, and email types with appropriate input types.
 */

import type { PluginConfigField } from '../../../../plugin-system/config-validator.js';
import { FieldWrapper } from './FieldWrapper.js';

/**
 * Props for StringField
 */
interface StringFieldProps {
  /** Field definition from schema */
  field: PluginConfigField;

  /** Current field value */
  value: unknown;

  /** Validation error message */
  error?: string | undefined;
}

/**
 * String Field Component
 *
 * Single-line text input with optional validation.
 */
export function StringField({ field, value, error }: StringFieldProps) {
  // Determine input type based on field type
  let inputType = 'text';
  if (field.type === 'url') {
    inputType = 'url';
  } else if (field.type === 'email') {
    inputType = 'email';
  }

  // Convert value to string
  const stringValue = typeof value === 'string' ? value : (field.default as string) || '';

  return (
    <FieldWrapper
      name={field.key}
      label={field.label}
      required={field.required}
      help={field.help}
      error={error}
    >
      <input
        type={inputType}
        id={field.key}
        name={field.key}
        defaultValue={stringValue}
        required={field.required}
        placeholder={field.placeholder}
        minLength={field.validation?.minLength}
        maxLength={field.validation?.maxLength}
        pattern={field.validation?.pattern}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
      />
    </FieldWrapper>
  );
}
