/**
 * SMTP Settings Section Component
 *
 * Renders form fields for email server configuration:
 * - SMTP host (text input)
 * - SMTP port (number input, 1-65535)
 * - SMTP username (text input)
 * - SMTP password (password input, masked)
 *
 * Features:
 * - Dark/light mode support
 * - Password field masking for security
 * - Port number validation (1-65535)
 */

import { Icon } from '@iconify/react';

export interface SMTPSettingsSectionProps {
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
}

export function SMTPSettingsSection({
  smtpHost,
  smtpPort,
  smtpUsername,
  smtpPassword,
}: SMTPSettingsSectionProps) {
  return (
    <section className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Icon icon="mdi:email" className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          SMTP Settings
        </h2>
      </div>

      <div className="space-y-4">
        {/* SMTP Host */}
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
            name="smtpHost"
            defaultValue={smtpHost}
            placeholder="smtp.example.com"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
        </div>

        {/* SMTP Port */}
        <div>
          <label
            htmlFor="smtpPort"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            SMTP Port
          </label>
          <input
            type="number"
            id="smtpPort"
            name="smtpPort"
            defaultValue={smtpPort}
            min={1}
            max={65535}
            placeholder="587"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Common ports: 25 (unencrypted), 587 (STARTTLS), 465 (SSL/TLS)
          </p>
        </div>

        {/* SMTP Username */}
        <div>
          <label
            htmlFor="smtpUsername"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            SMTP Username
          </label>
          <input
            type="text"
            id="smtpUsername"
            name="smtpUsername"
            defaultValue={smtpUsername}
            placeholder="username@example.com"
            autoComplete="username"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
        </div>

        {/* SMTP Password */}
        <div>
          <label
            htmlFor="smtpPassword"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            SMTP Password
          </label>
          <input
            type="password"
            id="smtpPassword"
            name="smtpPassword"
            defaultValue={smtpPassword}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Password is encrypted before storage
          </p>
        </div>
      </div>
    </section>
  );
}
