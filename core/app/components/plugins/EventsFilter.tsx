/**
 * Events Filter Component
 *
 * Provides filtering UI for events list with:
 * - Status multi-select (processed/failed/pending)
 * - Event type text search (with 2s debounce)
 * - Date range picker (start and end dates)
 * - Apply/Clear buttons
 *
 * Features:
 * - Responsive layout (horizontal on desktop, vertical on mobile)
 * - Dark mode support
 * - Accessible form controls
 * - Debounced event type search (2 seconds)
 */

import { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import type { EventsFilter, PluginEventStatus } from '~/types/plugin-events';

interface EventsFilterProps {
  filters: EventsFilter;
  onChange: (filters: EventsFilter) => void;
  loading?: boolean;
}

const STATUS_OPTIONS: Array<{ value: PluginEventStatus; label: string; color: string }> = [
  { value: 'processed', label: 'Processed', color: 'text-green-600 dark:text-green-400' },
  { value: 'failed', label: 'Failed', color: 'text-red-600 dark:text-red-400' },
  { value: 'pending', label: 'Pending', color: 'text-yellow-600 dark:text-yellow-400' },
];

/**
 * Events Filter Component
 */
export function EventsFilter({ filters, onChange, loading = false }: EventsFilterProps) {
  // Local state for text inputs
  const [localEventType, setLocalEventType] = useState(filters.eventType || '');
  const [localStartDate, setLocalStartDate] = useState(filters.startDate || '');
  const [localEndDate, setLocalEndDate] = useState(filters.endDate || '');

  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track which input should maintain focus after filter update
  const shouldRestoreFocusRef = useRef<string | null>(null);

  // Sync local state when filters prop changes (e.g., from Clear button)
  useEffect(() => {
    // Update local state to match filters
    setLocalEventType(filters.eventType || '');
    setLocalStartDate(filters.startDate || '');
    setLocalEndDate(filters.endDate || '');
  }, [filters.eventType, filters.startDate, filters.endDate]);

  // Restore focus after filters update (separate useEffect to run after state updates)
  useEffect(() => {
    if (shouldRestoreFocusRef.current) {
      const testId = shouldRestoreFocusRef.current;

      // Use requestAnimationFrame to ensure DOM has fully updated
      requestAnimationFrame(() => {
        const elementToFocus = document.querySelector(
          `[data-testid="${testId}"]`
        ) as HTMLInputElement | null;

        if (elementToFocus && !elementToFocus.disabled) {
          elementToFocus.focus();
          // Only clear the ref if we successfully focused
          shouldRestoreFocusRef.current = null;
        }
        // If disabled, don't clear the ref - let it retry when loading becomes false
      });
    }
  }, [filters.eventType, filters.startDate, filters.endDate, loading]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Handle status checkbox change
   */
  const handleStatusChange = (status: PluginEventStatus) => {
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
   * Apply event type filter immediately
   */
  const applyEventTypeFilter = (value: string) => {
    const updatedFilters: EventsFilter = {
      ...filters,
    };

    if (value.trim()) {
      updatedFilters.eventType = value.trim();
    } else {
      delete updatedFilters.eventType;
    }

    // Mark that we should restore focus after filter update
    shouldRestoreFocusRef.current = 'event-type-filter';

    onChange(updatedFilters);
  };

  /**
   * Handle event type change with debounce (2 seconds)
   */
  const handleEventTypeChange = (value: string) => {
    setLocalEventType(value);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer to apply filter after 2 seconds
    debounceTimerRef.current = setTimeout(() => {
      applyEventTypeFilter(value);
    }, 2000);
  };

  /**
   * Apply date filter (called on blur or change for date inputs)
   */
  const applyDateFilter = (field: 'startDate' | 'endDate', value: string) => {
    const updatedFilters: EventsFilter = {
      ...filters,
    };

    if (value) {
      updatedFilters[field] = value;
    } else {
      delete updatedFilters[field];
    }

    // Mark that we should restore focus after filter update
    shouldRestoreFocusRef.current =
      field === 'startDate' ? 'start-date-filter' : 'end-date-filter';

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
            Event Type (partial match)
          </label>
          <input
            id="event-type-filter"
            type="text"
            value={localEventType}
            onChange={(e) => handleEventTypeChange(e.target.value)}
            onBlur={() => {
              // Apply immediately on blur (cancel debounce)
              if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
              }
              applyEventTypeFilter(localEventType);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                // Apply immediately on Enter (cancel debounce)
                if (debounceTimerRef.current) {
                  clearTimeout(debounceTimerRef.current);
                }
                applyEventTypeFilter(localEventType);
              }
            }}
            disabled={loading}
            placeholder="Search event type... (auto-applies after 2s)"
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
              value={localStartDate}
              onChange={(e) => {
                setLocalStartDate(e.target.value);
                applyDateFilter('startDate', e.target.value);
              }}
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
              value={localEndDate}
              onChange={(e) => {
                setLocalEndDate(e.target.value);
                applyDateFilter('endDate', e.target.value);
              }}
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
