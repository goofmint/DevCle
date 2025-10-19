/**
 * Basic Settings Form Component
 *
 * Provides UI for editing basic system settings:
 * - Service Name
 * - Logo URL (or file upload if S3 configured)
 * - Fiscal Year Start Month
 * - Timezone
 *
 * Features:
 * - Dark/Light mode support
 * - Client-side validation
 * - Loading states
 * - Iconify icons (no inline SVG)
 * - Responsive design
 *
 * Props:
 * - serviceName: Current service name
 * - logoUrl: Current logo URL (nullable)
 * - fiscalYearStartMonth: Current fiscal year start month (1-12)
 * - timezone: Current timezone (IANA format)
 * - s3Configured: Boolean flag indicating if S3 is configured
 * - onSubmit: Form submission handler
 * - isSubmitting: Loading state
 */

import { useState } from 'react';
import { Icon } from '@iconify/react';
import { useDarkMode } from '~/contexts/dark-mode-context';

/**
 * Props interface for BasicSettingsForm
 */
export interface BasicSettingsFormProps {
  serviceName: string;
  logoUrl: string | null;
  fiscalYearStartMonth: number;
  timezone: string;
  s3Configured: boolean;
  onSubmit: (formData: FormData) => void;
  isSubmitting: boolean;
}

/**
 * Month options for fiscal year start dropdown
 * Generates array of {value: 1-12, label: "January" - "December"}
 */
const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

/**
 * BasicSettingsForm Component
 *
 * Renders a form for editing basic system settings.
 * Uses controlled components for all inputs.
 * Supports both light and dark modes with Tailwind CSS.
 */
export function BasicSettingsForm({
  serviceName: initialServiceName,
  logoUrl: initialLogoUrl,
  fiscalYearStartMonth: initialFiscalYearStartMonth,
  timezone: initialTimezone,
  s3Configured,
  onSubmit,
  isSubmitting,
}: BasicSettingsFormProps): JSX.Element {
  // Dark mode context for icon color adjustments
  const { isDark } = useDarkMode();

  // Local state for form fields
  const [serviceName, setServiceName] = useState(initialServiceName);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl || '');
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(
    initialFiscalYearStartMonth
  );
  const [timezone, setTimezone] = useState(initialTimezone);

  // Get timezone options from browser API
  // Intl.supportedValuesOf('timeZone') returns IANA timezone names
  const timezoneOptions = Intl.supportedValuesOf('timeZone');

  /**
   * Handle form submission
   * Creates FormData and passes to parent onSubmit handler
   */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('section', 'basic');
    formData.append('serviceName', serviceName);
    formData.append('logoUrl', logoUrl);
    formData.append('fiscalYearStartMonth', String(fiscalYearStartMonth));
    formData.append('timezone', timezone);

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <Icon
          icon="mdi:cog"
          className={`w-6 h-6 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}
        />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Basic Settings
        </h2>
      </div>

      {/* Service Name Field */}
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
          value={serviceName}
          onChange={(e) => setServiceName(e.target.value)}
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
          placeholder="DevCle"
          disabled={isSubmitting}
          data-testid="service-name-input"
        />
      </div>

      {/* Logo URL Field */}
      <div>
        <label
          htmlFor="logoUrl"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Logo URL {s3Configured && '(or upload below)'}
        </label>
        <input
          type="url"
          id="logoUrl"
          name="logoUrl"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          className="
            w-full px-3 py-2 border rounded-md
            bg-white dark:bg-gray-800
            border-gray-300 dark:border-gray-600
            text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          placeholder="https://example.com/logo.png"
          disabled={isSubmitting}
          data-testid="logo-url-input"
        />
        {s3Configured && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            You can also upload a logo file using the S3 upload feature (coming soon)
          </p>
        )}
      </div>

      {/* Fiscal Year Start Month Field */}
      <div>
        <label
          htmlFor="fiscalYearStartMonth"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Fiscal Year Start Month
        </label>
        <select
          id="fiscalYearStartMonth"
          name="fiscalYearStartMonth"
          value={fiscalYearStartMonth}
          onChange={(e) => setFiscalYearStartMonth(Number(e.target.value))}
          required
          className="
            w-full px-3 py-2 border rounded-md
            bg-white dark:bg-gray-800
            border-gray-300 dark:border-gray-600
            text-gray-900 dark:text-gray-100
            focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          disabled={isSubmitting}
          data-testid="fiscal-year-start-input"
        >
          {MONTH_OPTIONS.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
      </div>

      {/* Timezone Field */}
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
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          required
          className="
            w-full px-3 py-2 border rounded-md
            bg-white dark:bg-gray-800
            border-gray-300 dark:border-gray-600
            text-gray-900 dark:text-gray-100
            focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          disabled={isSubmitting}
          data-testid="timezone-input"
        >
          {timezoneOptions.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="
            px-4 py-2 rounded-md
            bg-indigo-600 hover:bg-indigo-700
            dark:bg-indigo-500 dark:hover:bg-indigo-600
            text-white font-medium
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-150
            flex items-center gap-2
          "
          data-testid="basic-settings-submit"
        >
          {isSubmitting ? (
            <>
              <Icon icon="mdi:loading" className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Icon icon="mdi:content-save" className="w-5 h-5" />
              Save Basic Settings
            </>
          )}
        </button>
      </div>
    </form>
  );
}
