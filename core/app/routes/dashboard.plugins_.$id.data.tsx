/**
 * Plugin Data Display Page
 *
 * Route: /dashboard/plugins/:id/data
 *
 * This page displays raw events collected by plugins stored in plugin_events_raw table.
 *
 * Features:
 * - Event list with pagination
 * - Filtering by status, event type, and date range
 * - Statistics summary
 * - Event detail modal with JSON viewer
 * - Reprocess failed events
 *
 * Implementation:
 * - SPA (client-side rendering, no SSR)
 * - Uses fetch for API calls with retry logic
 * - Error handling with toast notifications
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from '@remix-run/react';
import { Icon } from '@iconify/react';
import type {
  PluginEvent,
  EventsFilter,
  EventsStats,
  PaginationInfo,
  ListEventsResponse,
  EventsStatsResponse,
} from '~/types/plugin-events';
import { EventsStats as EventsStatsComponent } from '~/components/plugins/EventsStats';
import { EventsFilter as EventsFilterComponent } from '~/components/plugins/EventsFilter';
import { EventsTable } from '~/components/plugins/EventsTable';
import { EventDetailModal } from '~/components/plugins/EventDetailModal';
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
 * Plugin Data Page Component
 */
export default function PluginDataPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // State
  const [stats, setStats] = useState<EventsStats | null>(null);
  const [events, setEvents] = useState<PluginEvent[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    perPage: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState<EventsFilter>({});
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
    if (!id) return;

    setStatsLoading(true);
    try {
      const response = await fetchWithRetry(
        `/api/plugins/${id}/events/stats`,
        undefined,
        3,
        (attempt) => setRetryAttempt(attempt)
      );

      if (response.status === 401) {
        sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
        navigate('/login');
        return;
      }

      if (!response.ok) {
        throw new Error(getErrorMessage(response.status));
      }

      const data: EventsStatsResponse = await response.json();
      setStats(data);
      setRetryAttempt(0);
    } catch (error) {
      showToast('error', (error as Error).message || 'Failed to load statistics');
    } finally {
      setStatsLoading(false);
    }
  };

  /**
   * Fetch events
   */
  const fetchEvents = async () => {
    if (!id) return;

    setLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        perPage: pagination.perPage.toString(),
      });

      if (filters.status && filters.status.length > 0) {
        params.append('status', filters.status.join(','));
      }
      if (filters.eventType) {
        params.append('eventType', filters.eventType);
      }
      if (filters.startDate) {
        params.append('startDate', filters.startDate);
      }
      if (filters.endDate) {
        params.append('endDate', filters.endDate);
      }

      const response = await fetchWithRetry(
        `/api/plugins/${id}/events?${params.toString()}`,
        undefined,
        3,
        (attempt) => setRetryAttempt(attempt)
      );

      if (response.status === 401) {
        sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
        navigate('/login');
        return;
      }

      if (!response.ok) {
        throw new Error(getErrorMessage(response.status));
      }

      const data: ListEventsResponse = await response.json();
      setEvents(data.events);
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
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page
  };

  /**
   * Handle page change
   */
  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
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
    if (!id) return;

    setReprocessing(true);
    try {
      const response = await fetch(`/api/plugins/${id}/events/${eventId}/reprocess`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
        navigate('/login');
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
      // Refresh events after reprocessing
      fetchEvents();
    } catch (error) {
      showToast('error', (error as Error).message || 'Failed to reprocess event');
    } finally {
      setReprocessing(false);
    }
  };

  /**
   * Fetch stats on mount
   */
  useEffect(() => {
    fetchStats();
  }, [id]);

  /**
   * Fetch events when filters or pagination change
   */
  useEffect(() => {
    fetchEvents();
  }, [id, filters, pagination.page]);

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
          <Icon
            icon={
              toast.type === 'success'
                ? 'mdi:check-circle'
                : toast.type === 'warning'
                ? 'mdi:alert'
                : 'mdi:alert-circle'
            }
            className={`w-5 h-5 mr-3 ${
              toast.type === 'success'
                ? 'text-green-600 dark:text-green-400'
                : toast.type === 'warning'
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          />
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
            <Icon icon="mdi:close" className="w-5 h-5" />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Plugin Collected Data
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          View and manage events collected by this plugin from external sources.
        </p>
      </div>

      {/* Retry Indicator */}
      {retryAttempt > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <div className="flex items-center">
            <Icon icon="mdi:loading" className="w-5 h-5 text-yellow-600 dark:text-yellow-400 animate-spin mr-2" />
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
