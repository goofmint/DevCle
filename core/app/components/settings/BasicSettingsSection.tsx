/**
 * Basic Settings Section Component
 *
 * Renders form fields for basic system configuration:
 * - Service name (text input)
 * - Logo URL (text input with data URI support)
 * - Fiscal year start/end (MM-DD format)
 * - Timezone (select with IANA timezones)
 *
 * Features:
 * - Dark/light mode support
 * - Timezone dropdown populated from Intl.supportedValuesOf
 * - Input validation hints in placeholders
 */

import { Icon } from '@iconify/react';

export interface BasicSettingsSectionProps {
  serviceName: string;
  logoUrl: string;
  fiscalYearStart: string;
  fiscalYearEnd: string;
  timezone: string;
}

/**
 * Get list of IANA timezones
 * Falls back to empty array if not supported (server-side rendering)
 */
function getTimezones(): string[] {
  if (typeof Intl === 'undefined' || !Intl.supportedValuesOf) {
    return [];
  }
  return Intl.supportedValuesOf('timeZone');
}

export function BasicSettingsSection({
  serviceName,
  logoUrl,
  fiscalYearStart,
  fiscalYearEnd,
  timezone,
}: BasicSettingsSectionProps) {
  const timezones = getTimezones();

  return (
    <section className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Icon icon="mdi:cog" className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Basic Settings
        </h2>
      </div>

      <div className="space-y-4">
        {/* Service Name */}
        <div>
          <label
            htmlFor="serviceName"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Service Name
          </label>
          <input
            type="text"
            id="serviceName"
            name="serviceName"
            defaultValue={serviceName}
            placeholder="DevCle"
            maxLength={100}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
        </div>

        {/* Logo URL */}
        <div>
          <label
            htmlFor="logoUrl"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Logo URL
          </label>
          <input
            type="text"
            id="logoUrl"
            name="logoUrl"
            defaultValue={logoUrl}
            placeholder="https://example.com/logo.png or data:image/png;base64,..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Accepts PNG, JPEG, SVG (max 2MB). Use URL or data URI.
          </p>
        </div>

        {/* Fiscal Year Start */}
        <div>
          <label
            htmlFor="fiscalYearStart"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Fiscal Year Start
          </label>
          <input
            type="text"
            id="fiscalYearStart"
            name="fiscalYearStart"
            defaultValue={fiscalYearStart}
            placeholder="04-01"
            pattern="\d{2}-\d{2}"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Format: MM-DD (e.g., 04-01 for April 1st)
          </p>
        </div>

        {/* Fiscal Year End */}
        <div>
          <label
            htmlFor="fiscalYearEnd"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Fiscal Year End
          </label>
          <input
            type="text"
            id="fiscalYearEnd"
            name="fiscalYearEnd"
            defaultValue={fiscalYearEnd}
            placeholder="03-31"
            pattern="\d{2}-\d{2}"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Format: MM-DD (e.g., 03-31 for March 31st)
          </p>
        </div>

        {/* Timezone */}
        <div>
          <label
            htmlFor="timezone"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Timezone
          </label>
          <select
            id="timezone"
            name="timezone"
            defaultValue={timezone}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Browser detected: {timezone}
          </p>
        </div>
      </div>
    </section>
  );
}
