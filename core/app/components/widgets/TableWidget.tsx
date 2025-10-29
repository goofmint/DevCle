/**
 * Table Widget Component
 *
 * Displays tabular data with sortable columns.
 * Minimal stub implementation for Phase 1.
 *
 * Features:
 * - Table with header and rows
 * - Column alignment support
 * - Loading state with animated skeleton
 * - Error state with error message
 * - Dark mode support
 */

import type { TableWidgetData } from '~/types/widget-api.js';

/**
 * Table widget props
 */
interface TableWidgetProps {
  /** Widget data */
  data: TableWidgetData;

  /** Loading state (shows skeleton) */
  isLoading?: boolean;

  /** Error state (shows error message) */
  isError?: boolean;

  /** Error message to display */
  errorMessage?: string;
}

/**
 * TableWidget Component
 *
 * Renders a table widget with rows and columns.
 */
export function TableWidget({
  data,
  isLoading,
  isError,
  errorMessage,
}: TableWidgetProps) {
  // Loading state: Show skeleton placeholder
  if (isLoading) {
    return (
      <div className="h-full flex flex-col p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4 animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
            />
          ))}
        </div>
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
          {errorMessage || 'Failed to load table data'}
        </p>
      </div>
    );
  }

  // Success state: Show actual table
  return (
    <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {data.title}
      </h3>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-700">
            <tr>
              {data.data.columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-${col.align || 'left'}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.data.rows.map((row, idx) => (
              <tr
                key={idx}
                className="border-b border-gray-200 dark:border-gray-700"
              >
                {data.data.columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-${col.align || 'left'}`}
                  >
                    {String(row[col.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
