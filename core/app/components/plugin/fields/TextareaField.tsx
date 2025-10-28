/**
 * Textarea Field Component
 *
 * Renders a multi-line text input field.
 * Useful for longer text content like descriptions, JSON, code snippets.
 */

import type { PluginConfigField } from '../../../../plugin-system/config-validator.js';
import { FieldWrapper } from './FieldWrapper.js';

/**
 * Props for TextareaField
 */
interface TextareaFieldProps {
  /** Field definition from schema */
  field: PluginConfigField;

  /** Current field value */
  value: unknown;

  /** Validation error message */
  error?: string | undefined;
}

/**
 * Textarea Field Component
 *
 * Multi-line text input with optional validation.
 */
export function TextareaField({ field, value, error }: TextareaFieldProps) {
  // Convert value to string
  const stringValue = typeof value === 'string' ? value : (field.default as string) || '';

  return (
    <FieldWrapper
      name={field.name}
      label={field.label}
      required={field.required}
      help={field.help}
      error={error}
    >
      <textarea
        id={field.name}
        name={field.name}
        defaultValue={stringValue}
        required={field.required}
        placeholder={field.placeholder}
        minLength={field.validation?.minLength}
        maxLength={field.validation?.maxLength}
        rows={4}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-y"
      />
    </FieldWrapper>
  );
}
