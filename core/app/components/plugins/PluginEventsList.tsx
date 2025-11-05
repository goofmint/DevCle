/**
 * Plugin Events List Component
 *
 * Main container component for plugin events list page.
 * Integrates filters, table, and pagination.
 * Fetches data client-side via API on filter changes (no page reload).
 */

import { useState } from 'react';
import type {
  PluginEvent,
  EventsFilter,
  EventsStats,
  PaginationInfo,
  EventsStatsResponse,
} from '~/types/plugin-events';
import { EventsStats as EventsStatsComponent } from './EventsStats';
import { EventsFilter as EventsFilterComponent } from './EventsFilter';
import { EventsTable } from './EventsTable';
import { EventDetailModal } from './EventDetailModal';
import { fetchWithRetry } from '~/utils/fetch-with-retry';
import { getErrorMessage } from '~/utils/api-errors';

/**
 * Toast notification state
 */
interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning';
  message: string;
}

/**
 * Props for PluginEventsList component
 */
interface PluginEventsListProps {
  /** Plugin ID */
  pluginId: string;
  /** Initial list of events to display */
  initialEvents: PluginEvent[];
  /** Initial pagination info */
  initialPagination: PaginationInfo;
  /** Initial filter values */
  initialFilters: EventsFilter;
  /** Initial statistics */
  initialStats: EventsStats | null;
  /** Navigation function for auth redirects */
  onAuthRequired: () => void;
}

/**
 * PluginEventsList Component
 *
 * Renders plugin events list with filters, stats, and pagination.
 * Fetches data via API on filter changes (no page reload).
 */
export function PluginEventsList({
  pluginId,
  initialEvents,
  initialPagination,
  initialFilters,
  initialStats,
  onAuthRequired,
}: PluginEventsListProps) {
  // Component state
  const [events, setEvents] = useState<PluginEvent[]>(initialEvents);
  const [pagination, setPagination] = useState<PaginationInfo>(initialPagination);
  const [filters, setFilters] = useState<EventsFilter>(initialFilters);
  const [stats, setStats] = useState<EventsStats | null>(initialStats);
  const [selectedEvent, setSelectedEvent] = useState<PluginEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [retryAttempt, setRetryAttempt] = useState(0);

  /**
   * Show toast notification
   */
  const showToast = (type: Toast['type'], message: string) => {
    const toast: Toast = {
      id: Math.random().toString(36).substring(7),
      type,
      message,
    };

    setToasts((prev) => [...prev, toast]);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 5000);
  };

  /**
   * Dismiss toast
   */
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  /**
   * Fetch statistics
   */
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const response = await fetchWithRetry(
        `/api/plugins/${pluginId}/events/stats`,
        undefined,
        3,
        (attempt) => setRetryAttempt(attempt)
      );

      if (response.status === 401) {
        onAuthRequired();
        return;
      }

      if (!response.ok) {
        throw new Error(getErrorMessage(response.status));
      }

      const data: EventsStatsResponse = await response.json();

      // Transform API response to EventsStats format with calculated rates
      const transformedStats: EventsStats = {
        total: data.total,
        processed: data.processed,
        failed: data.failed,
        pending: data.pending,
        processingRate: data.total > 0
          ? (data.processed / data.total) * 100
          : 0,
        errorRate: data.total > 0
          ? (data.failed / data.total) * 100
          : 0,
      };
      setStats(transformedStats);
      setRetryAttempt(0);
    } catch (error) {
      showToast('error', (error as Error).message || 'Failed to load statistics');
    } finally {
      setStatsLoading(false);
    }
  };

  /**
   * Fetch events from API
   */
  const fetchEvents = async (newFilters: EventsFilter, page: number = 1) => {
    setLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams({
        page: page.toString(),
        perPage: pagination.perPage.toString(),
      });

      if (newFilters.status && newFilters.status.length > 0) {
        params.append('status', newFilters.status.join(','));
      }
      if (newFilters.eventType) {
        params.append('eventType', newFilters.eventType);
      }
      if (newFilters.startDate) {
        params.append('startDate', newFilters.startDate);
      }
      if (newFilters.endDate) {
        params.append('endDate', newFilters.endDate);
      }

      const response = await fetchWithRetry(
        `/api/plugins/${pluginId}/events?${params.toString()}`,
        undefined,
        3,
        (attempt) => setRetryAttempt(attempt)
      );

      if (response.status === 401) {
        onAuthRequired();
        return;
      }

      if (!response.ok) {
        throw new Error(getErrorMessage(response.status));
      }

      const data = await response.json();
      setEvents(data.items || []);
      setPagination(data.pagination);
      setRetryAttempt(0);
    } catch (error) {
      showToast('error', (error as Error).message || 'Failed to load events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle filter change
   */
  const handleFilterChange = (newFilters: EventsFilter) => {
    setFilters(newFilters);
    fetchEvents(newFilters, 1); // Reset to first page
  };

  /**
   * Handle page change
   */
  const handlePageChange = (page: number) => {
    fetchEvents(filters, page);
  };

  /**
   * Handle event click (open modal)
   */
  const handleEventClick = (event: PluginEvent) => {
    setSelectedEvent(event);
  };

  /**
   * Handle modal close
   */
  const handleModalClose = () => {
    setSelectedEvent(null);
  };

  /**
   * Handle reprocess
   */
  const handleReprocess = async (eventId: string) => {
    setReprocessing(true);
    try {
      const response = await fetch(`/api/plugins/${pluginId}/events/${eventId}/reprocess`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        onAuthRequired();
        return;
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '60';
        showToast('error', `Rate limit exceeded. Please wait ${retryAfter} seconds.`);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || getErrorMessage(response.status));
      }

      showToast('success', 'Event queued for reprocessing');
      handleModalClose();
      // Refresh events and stats after reprocessing
      fetchEvents(filters, pagination.page);
      fetchStats();
    } catch (error) {
      showToast('error', (error as Error).message || 'Failed to reprocess event');
    } finally {
      setReprocessing(false);
    }
  };

  /**
   * Toast notifications component
   */
  const ToastContainer = () => (
    <div className="fixed top-4 right-4 z-50 space-y-2" data-testid="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start p-4 rounded-lg shadow-lg border-l-4 ${
            toast.type === 'success'
              ? 'bg-white dark:bg-gray-800 border-green-500'
              : toast.type === 'warning'
              ? 'bg-white dark:bg-gray-800 border-yellow-500'
              : 'bg-white dark:bg-gray-800 border-red-500'
          }`}
          role="alert"
          data-testid="toast"
        >
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {toast.message}
            </p>
          </div>
          <button
            onClick={() => dismissToast(toast.id)}
            className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      {/* Retry Indicator */}
      {retryAttempt > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <div className="flex items-center">
            <span className="text-sm text-yellow-800 dark:text-yellow-200">
              Retrying... (Attempt {retryAttempt} of 3)
            </span>
          </div>
        </div>
      )}

      {/* Statistics */}
      <EventsStatsComponent stats={stats} loading={statsLoading} />

      {/* Filters */}
      <EventsFilterComponent
        filters={filters}
        onChange={handleFilterChange}
        loading={loading}
      />

      {/* Events Table */}
      <EventsTable
        events={events}
        pagination={pagination}
        onPageChange={handlePageChange}
        onEventClick={handleEventClick}
        loading={loading}
      />

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={handleModalClose}
          onReprocess={handleReprocess}
          reprocessing={reprocessing}
        />
      )}

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}
