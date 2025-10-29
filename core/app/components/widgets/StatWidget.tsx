/**
 * Stat Widget Component
 *
 * Displays a single numeric value with optional trend indicator.
 * Supports loading and error states with skeleton placeholders.
 *
 * Features:
 * - Large numeric display with locale formatting
 * - Trend indicator with up/down arrows and color coding
 * - Loading state with animated skeleton
 * - Error state with error message
 * - Dark mode support
 */

import type { StatWidgetData } from '~/types/widget-api.js';

/**
 * Stat widget props
 */
interface StatWidgetProps {
  /** Widget data */
  data: StatWidgetData;

  /** Loading state (shows skeleton) */
  isLoading?: boolean;

  /** Error state (shows error message) */
  isError?: boolean;

  /** Error message to display */
  errorMessage?: string;
}

/**
 * StatWidget Component
 *
 * Renders a stat widget with a large numeric value and optional trend.
 */
export function StatWidget({
  data,
  isLoading,
  isError,
  errorMessage,
}: StatWidgetProps) {
  // Loading state: Show skeleton placeholder
  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4 animate-pulse" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
      </div>
    );
  }

  // Error state: Show error message
  if (isError) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
          {data.title}
        </h3>
        <p className="text-sm text-red-700 dark:text-red-300">
          {errorMessage || 'Failed to load data'}
        </p>
      </div>
    );
  }

  // Success state: Show actual data
  return (
    <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      {/* Title */}
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
        {data.title}
      </h3>

      {/* Value */}
      <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
        {data.data.value.toLocaleString()}
      </div>

      {/* Trend indicator (optional) */}
      {data.data.trend && (
        <div className="mt-2 flex items-center gap-1">
          <span
            className={
              data.data.trend.direction === 'up'
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }
          >
            {data.data.trend.direction === 'up' ? '↑' : '↓'}{' '}
            {data.data.trend.value}%
          </span>
          {data.data.label && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {data.data.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
