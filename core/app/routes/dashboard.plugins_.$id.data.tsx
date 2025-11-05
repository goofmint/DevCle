/**
 * Plugin Data Display Page
 *
 * Route: /dashboard/plugins/:id/data
 *
 * This page displays raw events collected by plugins stored in plugin_events_raw table.
 *
 * Note: Uses SPA pattern - fetches data client-side via API calls.
 */

import { useParams, useNavigate, useSearchParams } from '@remix-run/react';
import { useState, useEffect } from 'react';
import type {
  PluginEvent,
  EventsFilter,
  EventsStats,
  PaginationInfo,
  ListEventsResponse,
  EventsStatsResponse,
} from '~/types/plugin-events';
import { PluginEventsList } from '~/components/plugins/PluginEventsList';
import { fetchWithRetry } from '~/utils/fetch-with-retry';
import { getErrorMessage } from '~/utils/api-errors';

/**
 * Plugin Data Page Component
 *
 * Fetches events and stats via API calls.
 * Manages loading and error states.
 */
export default function PluginDataPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<PluginEvent[]>([]);
  const [stats, setStats] = useState<EventsStats | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    perPage: 20,
    total: 0,
    totalPages: 0,
  });

  // Extract filter values from URL params
  const statusParam = searchParams.get('status');
  const status = statusParam ? statusParam.split(',') as Array<'processed' | 'failed' | 'pending'> : undefined;
  const eventType = searchParams.get('eventType') || undefined;
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);

  const filters: EventsFilter = {
    ...(status && { status }),
    ...(eventType && { eventType }),
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
  };

  /**
   * Handle auth redirect
   */
  const handleAuthRequired = () => {
    sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
    navigate('/login');
  };

  // Fetch initial data on mount only
  useEffect(() => {
    async function fetchData() {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);

        // Build API request parameters
        const params = new URLSearchParams({
          page: page.toString(),
          perPage: '20',
        });

        if (status && status.length > 0) {
          params.append('status', status.join(','));
        }
        if (eventType) {
          params.append('eventType', eventType);
        }
        if (startDate) {
          params.append('startDate', startDate);
        }
        if (endDate) {
          params.append('endDate', endDate);
        }

        // Fetch events and stats in parallel
        const [eventsResponse, statsResponse] = await Promise.all([
          fetchWithRetry(`/api/plugins/${id}/events?${params.toString()}`, undefined, 3),
          fetchWithRetry(`/api/plugins/${id}/events/stats`, undefined, 3),
        ]);

        if (eventsResponse.status === 401 || statsResponse.status === 401) {
          handleAuthRequired();
          return;
        }

        if (!eventsResponse.ok) {
          throw new Error(getErrorMessage(eventsResponse.status));
        }
        if (!statsResponse.ok) {
          throw new Error(getErrorMessage(statsResponse.status));
        }

        const eventsData: ListEventsResponse = await eventsResponse.json();
        const statsData: EventsStatsResponse = await statsResponse.json();

        setEvents(eventsData.items || []);
        setPagination(eventsData.pagination);

        // Transform API response to EventsStats format with calculated rates
        const transformedStats: EventsStats = {
          total: statsData.total,
          processed: statsData.processed,
          failed: statsData.failed,
          pending: statsData.pending,
          processingRate: statsData.total > 0
            ? (statsData.processed / statsData.total) * 100
            : 0,
          errorRate: statsData.total > 0
            ? (statsData.failed / statsData.total) * 100
            : 0,
        };
        setStats(transformedStats);
      } catch (err) {
        console.error('Failed to fetch plugin events:', err);
        setError(err instanceof Error ? err.message : 'Failed to load plugin events');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // Only fetch on mount or when plugin ID changes

  // Loading state
  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
          Plugin Collected Data
        </h1>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading events...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
          Plugin Collected Data
        </h1>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
            Error
          </h2>
          <p className="text-red-600 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

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

      <PluginEventsList
        pluginId={id!}
        initialEvents={events}
        initialPagination={pagination}
        initialFilters={filters}
        initialStats={stats}
        onAuthRequired={handleAuthRequired}
      />
    </div>
  );
}
