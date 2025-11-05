/**
 * Events Table Component
 *
 * Displays plugin events in a table format with:
 * - Event ID (truncated), Type, Status, Timestamps, Error message
 * - Status badges (color-coded)
 * - Pagination controls
 * - "View Detail" action button
 *
 * Features:
 * - Responsive table (horizontal scroll on mobile)
 * - Dark mode support
 * - Loading skeleton state
 * - Accessible table markup
 */

import { Icon } from '@iconify/react';
import type { PluginEvent, PaginationInfo } from '~/types/plugin-events';

interface EventsTableProps {
  events: PluginEvent[];
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  onEventClick: (event: PluginEvent) => void;
  loading?: boolean;
}

/**
 * Status Badge Component
 */
function StatusBadge({ status }: { status: PluginEvent['status'] }) {
  const config = {
    processed: {
      label: 'Processed',
      color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      icon: 'mdi:check-circle',
    },
    failed: {
      label: 'Failed',
      color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      icon: 'mdi:alert-circle',
    },
    pending: {
      label: 'Pending',
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      icon: 'mdi:clock-outline',
    },
  };

  const { label, color, icon } = config[status];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}
    >
      <Icon icon={icon} className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * Format timestamp
 */
function formatTimestamp(isoTimestamp: string | null): string {
  if (!isoTimestamp) return '—';
  try {
    const date = new Date(isoTimestamp);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date).replace(/(\d+)\/(\d+)\/(\d+),/, '$3-$1-$2');
  } catch {
    return '—';
  }
}

/**
 * Truncate text
 */
function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

/**
 * Pagination Controls Component
 */
function PaginationControls({ pagination, onPageChange }: {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
}) {
  const { page, totalPages } = pagination;

  // Generate page numbers to display (max 7 pages)
  const getPageNumbers = (): number[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (page <= 4) {
      return [1, 2, 3, 4, 5, -1, totalPages];
    }

    if (page >= totalPages - 3) {
      return [1, -1, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, -1, page - 1, page, page + 1, -1, totalPages];
  };

  return (
    <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 sm:px-6">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="relative inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Page <span className="font-medium">{page}</span> of{' '}
            <span className="font-medium">{totalPages}</span>
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <Icon icon="mdi:chevron-left" className="h-5 w-5" aria-hidden="true" />
            </button>
            {getPageNumbers().map((pageNum, idx) =>
              pageNum === -1 ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 ring-1 ring-inset ring-gray-300 dark:ring-gray-600"
                >
                  ...
                </span>
              ) : (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                    pageNum === page
                      ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                      : 'text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-offset-0'
                  }`}
                >
                  {pageNum}
                </button>
              )
            )}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <Icon icon="mdi:chevron-right" className="h-5 w-5" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}

/**
 * Events Table Component
 */
export function EventsTable({
  events,
  pagination,
  onPageChange,
  onEventClick,
  loading = false,
}: EventsTableProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="animate-pulse p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
        <Icon
          icon="mdi:database-off"
          className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600"
          aria-hidden="true"
        />
        <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">No events found</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Try adjusting your filters or check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" data-testid="events-table">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Event ID</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ingested At</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Processed At</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Error</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {events.map((event) => (
              <tr key={event.eventId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-100">
                  {truncate(event.eventId, 8)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {event.eventType}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={event.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {formatTimestamp(event.ingestedAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {formatTimestamp(event.processedAt)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                  {event.errorMessage || '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => onEventClick(event)}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                    data-testid={`view-detail-${event.eventId}`}
                  >
                    View Detail
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls pagination={pagination} onPageChange={onPageChange} />
    </div>
  );
}
