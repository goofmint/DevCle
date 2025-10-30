/**
 * Events Table Component
 *
 * Displays paginated list of plugin events in table format.
 */

import { Icon } from '@iconify/react';
import type { PluginEventListItem } from '../../../services/plugin-events/index.js';

interface EventsTableProps {
  events: PluginEventListItem[];
  onViewDetail: (eventId: string) => void;
}

export function EventsTable({ events, onViewDetail }: EventsTableProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <Icon
          icon="mdi:database-off"
          className="mx-auto text-6xl text-gray-400 dark:text-gray-600 mb-4"
        />
        <p className="text-gray-600 dark:text-gray-400">No events found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Ingested At
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Event Type
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Status
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Processed At
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {events.map((event) => (
            <tr
              key={event.eventId}
              className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {formatDateTime(event.ingestedAt)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <code className="text-sm font-mono text-gray-700 dark:text-gray-300">
                  {event.eventType}
                </code>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <StatusBadge status={event.status} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {event.processedAt ? formatDateTime(event.processedAt) : '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                <button
                  onClick={() => onViewDetail(event.eventId)}
                  className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                >
                  <Icon icon="mdi:eye" className="text-lg" />
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Status Badge Component
 */
interface StatusBadgeProps {
  status: 'pending' | 'processed' | 'failed';
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    processed: {
      icon: 'mdi:check-circle',
      className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    },
    failed: {
      icon: 'mdi:alert-circle',
      className: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    },
    pending: {
      icon: 'mdi:clock-outline',
      className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
    },
  };

  const { icon, className } = config[status];

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium
        ${className}
      `}
    >
      <Icon icon={icon} className="text-sm" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

/**
 * Format date time to readable string
 */
function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(date));
}
