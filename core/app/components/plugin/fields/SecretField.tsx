/**
 * Secret Field Component
 *
 * Renders a password input field with toggle visibility feature.
 * Implements "Change this setting" toggle pattern (Option D) for existing secrets.
 *
 * When a secret exists ({ _exists: true }):
 * - Shows "Change this setting" checkbox
 * - Only shows input field when checkbox is checked
 * - Sends { _exists: true } marker when unchanged to preserve existing value
 */

import { useState } from 'react';
import { Icon } from '@iconify/react';
import type { PluginConfigField } from '../../../../plugin-system/config-validator.js';
import { FieldWrapper } from './FieldWrapper.js';

/**
 * Props for SecretField
 */
interface SecretFieldProps {
  /** Field definition from schema */
  field: PluginConfigField;

  /** Current field value (may be { _exists: true } marker) */
  value: unknown;

  /** Validation error message */
  error?: string | undefined;
}

/**
 * Check if value is a secret exists marker
 */
function isSecretExistsMarker(value: unknown): value is { _exists: true } {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_exists' in value &&
    (value as { _exists: unknown })._exists === true
  );
}

/**
 * Secret Field Component
 *
 * Password input with show/hide toggle and "Change this setting" pattern.
 */
export function SecretField({ field, value, error }: SecretFieldProps) {
  const existingSecretExists = isSecretExistsMarker(value);
  const [changeSecret, setChangeSecret] = useState(!existingSecretExists);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <FieldWrapper
      name={field.key}
      label={field.label}
      required={field.required && !existingSecretExists}
      help={field.help}
      error={error}
    >
      <div className="space-y-3">
        {/* Change Secret Checkbox (only shown when secret exists) */}
        {existingSecretExists && (
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={changeSecret}
              onChange={(e) => setChangeSecret(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400"
            />
            <span>Change this setting</span>
          </label>
        )}

        {/* Secret Input Field (shown when changing secret) */}
        {changeSecret ? (
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id={field.key}
              name={field.key}
              required={field.required}
              placeholder={field.placeholder || '••••••••'}
              minLength={field.validation?.minLength}
              maxLength={field.validation?.maxLength}
              pattern={field.validation?.pattern}
              className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />

            {/* Show/Hide Toggle Button */}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <Icon
                icon={showPassword ? 'mdi:eye-off' : 'mdi:eye'}
                className="w-5 h-5"
              />
            </button>
          </div>
        ) : (
          // Hidden input with _exists marker (preserve existing value)
          <>
            <input
              type="hidden"
              name={field.key}
              value={JSON.stringify({ _exists: true })}
            />
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400">
              <Icon icon="mdi:check-circle" className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span>Secret is set (unchanged)</span>
            </div>
          </>
        )}
      </div>
    </FieldWrapper>
  );
}
