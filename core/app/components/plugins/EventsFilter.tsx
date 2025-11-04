/**
 * Events Filter Component
 *
 * Provides filtering UI for events list with:
 * - Status multi-select (processed/failed/pending)
 * - Event type text search
 * - Date range picker (start and end dates)
 * - Apply/Clear buttons
 *
 * Features:
 * - Responsive layout (horizontal on desktop, vertical on mobile)
 * - Dark mode support
 * - Accessible form controls
 */

import { Icon } from '@iconify/react';
import type { EventsFilter } from '~/types/plugin-events';

interface EventsFilterProps {
  filters: EventsFilter;
  onChange: (filters: EventsFilter) => void;
  loading?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'processed', label: 'Processed', color: 'text-green-600 dark:text-green-400' },
  { value: 'failed', label: 'Failed', color: 'text-red-600 dark:text-red-400' },
  { value: 'pending', label: 'Pending', color: 'text-yellow-600 dark:text-yellow-400' },
];

/**
 * Events Filter Component
 */
export function EventsFilter({ filters, onChange, loading = false }: EventsFilterProps) {
  /**
   * Handle status checkbox change
   */
  const handleStatusChange = (status: string) => {
    const currentStatus = filters.status || [];
    const newStatus = currentStatus.includes(status)
      ? currentStatus.filter((s) => s !== status)
      : [...currentStatus, status];

    const updatedFilters: EventsFilter = {
      ...filters,
    };

    if (newStatus.length > 0) {
      updatedFilters.status = newStatus;
    } else {
      delete updatedFilters.status;
    }

    onChange(updatedFilters);
  };

  /**
   * Handle event type input change
   */
  const handleEventTypeChange = (value: string) => {
    const updatedFilters: EventsFilter = {
      ...filters,
    };

    if (value) {
      updatedFilters.eventType = value;
    } else {
      delete updatedFilters.eventType;
    }

    onChange(updatedFilters);
  };

  /**
   * Handle date change
   */
  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    const updatedFilters: EventsFilter = {
      ...filters,
    };

    if (value) {
      updatedFilters[field] = value;
    } else {
      delete updatedFilters[field];
    }

    onChange(updatedFilters);
  };

  /**
   * Clear all filters
   */
  const handleClear = () => {
    onChange({});
  };

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = Boolean(
    filters.status?.length ||
    filters.eventType ||
    filters.startDate ||
    filters.endDate
  );

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6"
      data-testid="events-filter"
    >
      <div className="flex items-center mb-4">
        <Icon
          icon="mdi:filter"
          className="w-5 h-5 text-gray-600 dark:text-gray-400 mr-2"
          aria-hidden="true"
        />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Filters
        </h2>
      </div>

      <div className="space-y-4">
        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Status
          </label>
          <div className="flex flex-wrap gap-3">
            {STATUS_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="inline-flex items-center cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={filters.status?.includes(option.value) ?? false}
                  onChange={() => handleStatusChange(option.value)}
                  disabled={loading}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  data-testid={`status-filter-${option.value}`}
                />
                <span className={`ml-2 text-sm ${option.color}`}>
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Event Type Filter */}
        <div>
          <label
            htmlFor="event-type-filter"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Event Type
          </label>
          <input
            id="event-type-filter"
            type="text"
            value={filters.eventType || ''}
            onChange={(e) => handleEventTypeChange(e.target.value)}
            disabled={loading}
            placeholder="Search event type..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="event-type-filter"
          />
        </div>

        {/* Date Range Filter */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="start-date-filter"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Start Date
            </label>
            <input
              id="start-date-filter"
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => handleDateChange('startDate', e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="start-date-filter"
            />
          </div>

          <div>
            <label
              htmlFor="end-date-filter"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              End Date
            </label>
            <input
              id="end-date-filter"
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => handleDateChange('endDate', e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="end-date-filter"
            />
          </div>
        </div>

        {/* Action Buttons */}
        {hasActiveFilters && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleClear}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="clear-filters-button"
            >
              <Icon icon="mdi:close" className="w-4 h-4 mr-1" aria-hidden="true" />
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
