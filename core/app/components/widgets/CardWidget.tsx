/**
 * Card Widget Component
 *
 * Displays free-form content with optional action buttons.
 * Minimal stub implementation for Phase 1.
 *
 * Features:
 * - Content area with plain text (markdown support TODO)
 * - Optional action buttons
 * - Loading state with animated skeleton
 * - Error state with error message
 * - Dark mode support
 */

import type { CardWidgetData } from '~/types/widget-api.js';

/**
 * Card widget props
 */
interface CardWidgetProps {
  /** Widget data */
  data: CardWidgetData;

  /** Loading state (shows skeleton) */
  isLoading?: boolean;

  /** Error state (shows error message) */
  isError?: boolean;

  /** Error message to display */
  errorMessage?: string;
}

/**
 * CardWidget Component
 *
 * Renders a card widget with content and optional actions.
 */
export function CardWidget({
  data,
  isLoading,
  isError,
  errorMessage,
}: CardWidgetProps) {
  // Loading state: Show skeleton placeholder
  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4 animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6 animate-pulse" />
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
          {errorMessage || 'Failed to load card data'}
        </p>
      </div>
    );
  }

  // Success state: Show actual card
  return (
    <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {data.title}
      </h3>

      {/* Content area */}
      <div className="prose prose-sm dark:prose-invert max-w-none mb-4">
        {/* TODO: Markdown rendering (react-markdown or similar) */}
        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
          {data.data.content}
        </p>
      </div>

      {/* Action buttons (optional) */}
      {data.data.actions && data.data.actions.length > 0 && (
        <div className="flex gap-2 mt-4">
          {data.data.actions.map((action, idx) => (
            <a
              key={idx}
              href={action.url}
              className={
                action.variant === 'primary'
                  ? 'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'
                  : 'px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600'
              }
            >
              {action.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
