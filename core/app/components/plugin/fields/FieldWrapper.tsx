/**
 * Field Wrapper Component
 *
 * Provides consistent styling for form fields including:
 * - Label with required indicator
 * - Help text
 * - Error message display
 * - Dark mode support
 */

import { Icon } from '@iconify/react';
import type { ReactNode } from 'react';

/**
 * Props for FieldWrapper
 */
interface FieldWrapperProps {
  /** Field name (for label htmlFor) */
  name: string;

  /** Field label text */
  label: string;

  /** Whether field is required */
  required: boolean;

  /** Optional help text displayed below label */
  help?: string | undefined;

  /** Optional error message */
  error?: string | undefined;

  /** Field input element */
  children: ReactNode;
}

/**
 * Field Wrapper Component
 *
 * Wraps form fields with consistent label, help text, and error styling.
 */
export function FieldWrapper({
  name,
  label,
  required,
  help,
  error,
  children,
}: FieldWrapperProps) {
  return (
    <div>
      {/* Label */}
      <label
        htmlFor={name}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
      >
        {label}
        {required && (
          <span className="text-red-600 dark:text-red-400 ml-1">*</span>
        )}
      </label>

      {/* Help Text */}
      {help && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          {help}
        </p>
      )}

      {/* Input Field */}
      {children}

      {/* Error Message */}
      {error && (
        <div className="mt-2 flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
          <Icon icon="mdi:alert-circle" className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
