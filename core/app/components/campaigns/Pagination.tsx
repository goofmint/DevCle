/**
 * Pagination Component
 *
 * Provides pagination UI for navigating through paginated lists.
 * Shows page numbers, previous/next buttons, and total count.
 * Syncs with URL parameters for shareable links.
 */

import { Link, useSearchParams } from '@remix-run/react';
import { Icon } from '@iconify/react';

/**
 * Props for Pagination component
 */
interface PaginationProps {
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Total number of items */
  totalItems: number;
}

/**
 * Pagination Component
 *
 * Renders pagination controls with page numbers, prev/next buttons.
 * Generates links with preserved query parameters.
 */
export function Pagination({
  currentPage,
  totalPages,
  totalItems,
}: PaginationProps) {
  const [searchParams] = useSearchParams();

  // Generate URL with updated page parameter
  // Clamp page to valid range [1, totalPages]
  const getPageUrl = (page: number) => {
    const clampedPage = Math.max(1, Math.min(page, totalPages));
    const params = new URLSearchParams(searchParams);
    params.set('page', String(clampedPage));
    return `?${params.toString()}`;
  };

  // Generate array of page numbers to display
  // Show: [1] ... [current-1] [current] [current+1] ... [totalPages]
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Calculate range around current page
      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);

      // Add ellipsis before current range if needed
      if (startPage > 2) {
        pages.push('...');
      }

      // Add range around current page
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      // Add ellipsis after current range if needed
      if (endPage < totalPages - 1) {
        pages.push('...');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  // Don't show pagination if only one page
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div
      className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 sm:px-6"
      data-testid="pagination"
    >
      {/* Mobile: Simple prev/next */}
      <div className="flex flex-1 justify-between sm:hidden">
        {currentPage > 1 ? (
          <Link
            to={getPageUrl(currentPage - 1)}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600
                       text-sm font-medium rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
                       hover:bg-gray-50 dark:hover:bg-gray-700"
            aria-label="Previous page"
            data-testid="prev-page"
          >
            Previous
          </Link>
        ) : (
          <span
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600
                       text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
            aria-disabled="true"
          >
            Previous
          </span>
        )}
        {currentPage < totalPages ? (
          <Link
            to={getPageUrl(currentPage + 1)}
            className="relative ml-3 inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600
                       text-sm font-medium rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
                       hover:bg-gray-50 dark:hover:bg-gray-700"
            aria-label="Next page"
            data-testid="next-page"
          >
            Next
          </Link>
        ) : (
          <span
            className="relative ml-3 inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600
                       text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
            aria-disabled="true"
          >
            Next
          </span>
        )}
      </div>

      {/* Desktop: Full pagination */}
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        {/* Results count */}
        <div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Showing page{' '}
            <span className="font-medium">{currentPage}</span> of{' '}
            <span className="font-medium">{totalPages}</span> (
            <span className="font-medium">{totalItems}</span> total campaigns)
          </p>
        </div>

        {/* Page numbers */}
        <div>
          <nav
            className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
            aria-label="Pagination"
          >
            {/* Previous button */}
            {currentPage > 1 ? (
              <Link
                to={getPageUrl(currentPage - 1)}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600
                           text-sm font-medium bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400
                           hover:bg-gray-50 dark:hover:bg-gray-700"
                aria-label="Previous page"
              >
                <span className="sr-only">Previous</span>
                <Icon icon="heroicons:chevron-left" className="h-5 w-5" />
              </Link>
            ) : (
              <span
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600
                           text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                aria-disabled="true"
                aria-label="Previous page (disabled)"
              >
                <span className="sr-only">Previous</span>
                <Icon icon="heroicons:chevron-left" className="h-5 w-5" />
              </span>
            )}

            {/* Page numbers */}
            {pageNumbers.map((page, index) => {
              if (page === '...') {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600
                               bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    ...
                  </span>
                );
              }

              const isCurrentPage = page === currentPage;
              return (
                <Link
                  key={page}
                  to={getPageUrl(page as number)}
                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium
                             ${
                               isCurrentPage
                                 ? 'z-10 bg-blue-50 dark:bg-blue-900 border-blue-500 dark:border-blue-600 text-blue-600 dark:text-blue-300'
                                 : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                             }`}
                  aria-current={isCurrentPage ? 'page' : undefined}
                  aria-label={isCurrentPage ? `Current page, page ${page}` : `Go to page ${page}`}
                  data-testid={`page-${page}`}
                >
                  {page}
                </Link>
              );
            })}

            {/* Next button */}
            {currentPage < totalPages ? (
              <Link
                to={getPageUrl(currentPage + 1)}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600
                           text-sm font-medium bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400
                           hover:bg-gray-50 dark:hover:bg-gray-700"
                aria-label="Next page"
                data-testid="next-page"
              >
                <span className="sr-only">Next</span>
                <Icon icon="heroicons:chevron-right" className="h-5 w-5" />
              </Link>
            ) : (
              <span
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600
                           text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                aria-disabled="true"
                aria-label="Next page (disabled)"
              >
                <span className="sr-only">Next</span>
                <Icon icon="heroicons:chevron-right" className="h-5 w-5" />
              </span>
            )}
          </nav>
        </div>
      </div>
    </div>
  );
}
