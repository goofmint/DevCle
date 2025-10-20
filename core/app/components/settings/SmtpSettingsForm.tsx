/**
 * SMTP Settings Form Component
 *
 * Provides UI for editing SMTP integration settings:
 * - Host
 * - Port
 * - Use TLS (checkbox)
 * - Username
 * - Password (masked)
 * - From Address
 * - Connection test button
 *
 * Features:
 * - Dark/Light mode support
 * - Password-type input for password (masked)
 * - Status indicator (configured/not configured)
 * - Test connection functionality
 * - Iconify icons (no inline SVG)
 * - Responsive design
 *
 * Props:
 * - smtpConfigured: Boolean flag indicating if SMTP is already configured
 * - onSubmit: Form submission handler
 * - onTestConnection: Test connection handler
 * - isSubmitting: Loading state for form submission
 * - isTesting: Loading state for connection test
 */

import { useState } from 'react';
import { Icon } from '@iconify/react';
import { useDarkMode } from '~/contexts/dark-mode-context';

/**
 * Props interface for SmtpSettingsForm
 */
export interface SmtpSettingsFormProps {
  smtpConfigured: boolean;
  onSubmit: (formData: FormData) => void;
  onTestConnection: (formData: FormData) => void;
  isSubmitting: boolean;
  isTesting: boolean;
}

/**
 * SmtpSettingsForm Component
 *
 * Renders a form for editing SMTP integration settings.
 * Uses controlled components for all inputs.
 * Supports both light and dark modes with Tailwind CSS.
 *
 * Security:
 * - Password is masked with password input type
 * - Only sends data on explicit form submission
 * - Never logs sensitive credentials
 */
export function SmtpSettingsForm({
  smtpConfigured,
  onSubmit,
  onTestConnection,
  isSubmitting,
  isTesting,
}: SmtpSettingsFormProps): JSX.Element {
  // Dark mode context for icon color adjustments
  const { isDark } = useDarkMode();

  // Local state for form fields
  // Note: We don't pre-populate secret fields from server for security
  const [host, setHost] = useState('');
  const [port, setPort] = useState('587'); // Default SMTP submission port with STARTTLS
  const [useTls, setUseTls] = useState(false); // SSL/SMTPS disabled by default (use STARTTLS on 587 instead)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fromAddress, setFromAddress] = useState('');

  /**
   * Handle form submission
   * Creates FormData and passes to parent onSubmit handler
   */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('section', 'smtp');
    formData.append('host', host);
    formData.append('port', port);
    formData.append('useTls', String(useTls));
    formData.append('username', username);
    formData.append('password', password);
    formData.append('fromAddress', fromAddress);

    onSubmit(formData);
  };

  /**
   * Handle test connection button click
   * Creates FormData with current form values and passes to parent handler
   */
  const handleTestConnection = () => {
    const formData = new FormData();
    formData.append('host', host);
    formData.append('port', port);
    formData.append('useTls', String(useTls));
    formData.append('username', username);
    formData.append('password', password);
    formData.append('fromAddress', fromAddress);

    onTestConnection(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon
            icon="mdi:email"
            className={`w-6 h-6 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}
          />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            SMTP Settings
          </h2>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          {smtpConfigured ? (
            <>
              <Icon icon="mdi:check-circle" className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                Configured
              </span>
            </>
          ) : (
            <>
              <Icon icon="mdi:alert-circle" className="w-5 h-5 text-yellow-500" />
              <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                Not Configured
              </span>
            </>
          )}
        </div>
      </div>

      {/* Host Field */}
      <div>
        <label
          htmlFor="smtpHost"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          SMTP Host
        </label>
        <input
          type="text"
          id="smtpHost"
          name="host"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          required
          className="
            w-full px-3 py-2 border rounded-md
            bg-white dark:bg-gray-800
            border-gray-300 dark:border-gray-600
            text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          placeholder="smtp.example.com"
          disabled={isSubmitting || isTesting}
          data-testid="smtp-host-input"
        />
      </div>

      {/* Port Field */}
      <div>
        <label
          htmlFor="smtpPort"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Port
        </label>
        <input
          type="number"
          id="smtpPort"
          name="port"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          required
          min="1"
          max="65535"
          className="
            w-full px-3 py-2 border rounded-md
            bg-white dark:bg-gray-800
            border-gray-300 dark:border-gray-600
            text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          placeholder="587"
          disabled={isSubmitting || isTesting}
          data-testid="smtp-port-input"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Port 587: STARTTLS (recommended), Port 465: SSL/SMTPS (check box below), Port 25: legacy
        </p>
      </div>

      {/* Use SSL Checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="smtpUseTls"
          name="useTls"
          checked={useTls}
          onChange={(e) => setUseTls(e.target.checked)}
          className="
            w-4 h-4 rounded
            border-gray-300 dark:border-gray-600
            text-indigo-600 dark:text-indigo-500
            focus:ring-2 focus:ring-indigo-500
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          disabled={isSubmitting || isTesting}
          data-testid="smtp-use-tls-checkbox"
        />
        <label
          htmlFor="smtpUseTls"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Use SSL/SMTPS (port 465 only)
        </label>
      </div>

      {/* Username Field */}
      <div>
        <label
          htmlFor="smtpUsername"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Username
        </label>
        <input
          type="text"
          id="smtpUsername"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="
            w-full px-3 py-2 border rounded-md
            bg-white dark:bg-gray-800
            border-gray-300 dark:border-gray-600
            text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          placeholder="user@example.com"
          disabled={isSubmitting || isTesting}
          data-testid="smtp-username-input"
        />
      </div>

      {/* Password Field */}
      <div>
        <label
          htmlFor="smtpPassword"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Password
        </label>
        <input
          type="password"
          id="smtpPassword"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="
            w-full px-3 py-2 border rounded-md
            bg-white dark:bg-gray-800
            border-gray-300 dark:border-gray-600
            text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          placeholder="••••••••••••••••••••••••••••••••"
          disabled={isSubmitting || isTesting}
          data-testid="smtp-password-input"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Your password will be encrypted before storage
        </p>
      </div>

      {/* From Address Field */}
      <div>
        <label
          htmlFor="smtpFromAddress"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          From Address
        </label>
        <input
          type="email"
          id="smtpFromAddress"
          name="fromAddress"
          value={fromAddress}
          onChange={(e) => setFromAddress(e.target.value)}
          required
          className="
            w-full px-3 py-2 border rounded-md
            bg-white dark:bg-gray-800
            border-gray-300 dark:border-gray-600
            text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          placeholder="noreply@example.com"
          disabled={isSubmitting || isTesting}
          data-testid="smtp-from-address-input"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Email address used as the sender for outgoing emails
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between">
        {/* Test Connection Button */}
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={
            isSubmitting || isTesting || !host || !port || !username || !password || !fromAddress
          }
          className="
            px-4 py-2 rounded-md
            bg-gray-600 hover:bg-gray-700
            dark:bg-gray-500 dark:hover:bg-gray-600
            text-white font-medium
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-150
            flex items-center gap-2
          "
          data-testid="smtp-test-connection-button"
        >
          {isTesting ? (
            <>
              <Icon icon="mdi:loading" className="w-5 h-5 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Icon icon="mdi:connection" className="w-5 h-5" />
              Test Connection
            </>
          )}
        </button>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || isTesting}
          className="
            px-4 py-2 rounded-md
            bg-indigo-600 hover:bg-indigo-700
            dark:bg-indigo-500 dark:hover:bg-indigo-600
            text-white font-medium
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-150
            flex items-center gap-2
          "
          data-testid="smtp-settings-submit"
        >
          {isSubmitting ? (
            <>
              <Icon icon="mdi:loading" className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Icon icon="mdi:content-save" className="w-5 h-5" />
              Save SMTP Settings
            </>
          )}
        </button>
      </div>
    </form>
  );
}
