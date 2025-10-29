/**
 * Runs Pagination Component
 *
 * Displays pagination controls for navigating through pages of plugin runs.
 * Shows current page, total pages, and navigation buttons.
 */

/**
 * Runs Pagination Props
 */
interface RunsPaginationProps {
  /** Current page number (1-indexed) */
  page: number;
  /** Total number of pages */
  totalPages: number;
  /** Total number of runs */
  total: number;
  /** Handler for navigating to previous page */
  onPrevious: () => void;
  /** Handler for navigating to next page */
  onNext: () => void;
}

/**
 * Runs Pagination Component
 *
 * Renders pagination controls with previous/next buttons.
 * Buttons are disabled at the first/last pages.
 *
 * @param page - Current page number (1-indexed)
 * @param totalPages - Total number of pages
 * @param total - Total number of runs
 * @param onPrevious - Handler for navigating to previous page
 * @param onNext - Handler for navigating to next page
 */
export function RunsPagination({
  page,
  totalPages,
  total,
  onPrevious,
  onNext,
}: RunsPaginationProps) {
  // Don't render pagination if there's only one page
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="mt-4 flex items-center justify-between">
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Page {page} of {totalPages} ({total} total runs)
      </div>
      <div className="flex gap-2">
        <button
          onClick={onPrevious}
          disabled={page === 1}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          data-testid="pagination-previous"
        >
          Previous
        </button>
        <button
          onClick={onNext}
          disabled={page === totalPages}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          data-testid="pagination-next"
        >
          Next
        </button>
      </div>
    </div>
  );
}
