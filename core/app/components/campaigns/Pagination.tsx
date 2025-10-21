/**
 * Pagination Component
 *
 * Provides pagination UI with page number links and prev/next buttons.
 */

import { Icon } from '@iconify/react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  /**
   * Generate page numbers to display
   * Show: 1 ... 4 5 6 ... 10
   */
  const generatePageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      // Show all pages if total is less than max
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const pages = generatePageNumbers();

  return (
    <nav
      className="flex items-center justify-center gap-2 mt-6"
      data-testid="pagination"
      aria-label="Pagination"
    >
      {/* Previous button */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        data-testid="prev-page"
      >
        <Icon icon="heroicons:chevron-left" className="w-5 h-5" />
      </button>

      {/* Page numbers */}
      {pages.map((page, index) =>
        typeof page === 'number' ? (
          <button
            key={index}
            type="button"
            onClick={() => onPageChange(page)}
            className={`px-4 py-2 border rounded-md transition-colors ${
              page === currentPage
                ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
            data-testid={`page-${page}`}
          >
            {page}
          </button>
        ) : (
          <span
            key={index}
            className="px-2 text-gray-500 dark:text-gray-400"
            data-testid="pagination-ellipsis"
          >
            {page}
          </span>
        )
      )}

      {/* Next button */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        data-testid="next-page"
      >
        <Icon icon="heroicons:chevron-right" className="w-5 h-5" />
      </button>
    </nav>
  );
}
