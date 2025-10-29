/**
 * List Widget Component
 *
 * Displays a list of items with optional links and timestamps.
 * Minimal stub implementation for Phase 1.
 *
 * Features:
 * - List items with title, description, and timestamp
 * - Optional links for each item
 * - Loading state with animated skeleton
 * - Error state with error message
 * - Dark mode support
 */

import type { ListWidgetData } from '~/types/widget-api.js';

/**
 * List widget props
 */
interface ListWidgetProps {
  /** Widget data */
  data: ListWidgetData;

  /** Loading state (shows skeleton) */
  isLoading?: boolean;

  /** Error state (shows error message) */
  isError?: boolean;

  /** Error message to display */
  errorMessage?: string;
}

/**
 * ListWidget Component
 *
 * Renders a list widget with items.
 */
export function ListWidget({
  data,
  isLoading,
  isError,
  errorMessage,
}: ListWidgetProps) {
  // Loading state: Show skeleton placeholder
  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4 animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
            </div>
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
          {errorMessage || 'Failed to load list data'}
        </p>
      </div>
    );
  }

  // Success state: Show actual list
  return (
    <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {data.title}
      </h3>

      {/* List */}
      <ul className="space-y-3">
        {data.data.items.map((item) => (
          <li key={item.id} className="border-l-2 border-blue-500 pl-4 py-2">
            {/* Item title (with optional link) */}
            {item.link ? (
              <a
                href={item.link}
                className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                {item.title}
              </a>
            ) : (
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {item.title}
              </div>
            )}

            {/* Item description (optional) */}
            {item.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {item.description}
              </p>
            )}

            {/* Item timestamp (optional) */}
            {item.timestamp && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {new Date(item.timestamp).toLocaleString()}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
