/**
 * Plugin Data Display Page
 *
 * Main page for displaying plugin event data collected from external APIs.
 * Shows statistics, event list, and detailed event information.
 *
 * Route: /dashboard/plugins/:id
 */

import { useState } from 'react';
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useSearchParams, useNavigate } from '@remix-run/react';
import { Icon } from '@iconify/react';
import { requireAuth } from '../../../middleware/auth.js';
import { getPlugin } from '../../../../services/plugin.service.js';
import { EventsStats } from '../../../components/plugins/EventsStats';
import { EventsTable } from '../../../components/plugins/EventsTable';
import { EventDetailModal } from '../../../components/plugins/EventDetailModal';
import { Pagination } from '../../../components/plugins/Pagination';
import type { EventsStats as EventsStatsType, PluginEventListItem } from '../../../../services/plugin-events/index.js';

/**
 * Loader function - fetches plugin info, stats, and events
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  const pluginId = params['id'];

  if (!pluginId) {
    throw new Response('Plugin ID is required', { status: 400 });
  }

  // Get plugin info
  const plugin = await getPlugin(user.tenantId, pluginId);
  if (!plugin) {
    throw new Response('Plugin not found', { status: 404 });
  }

  // Get query parameters for pagination
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') || '1');
  const perPage = Number(url.searchParams.get('perPage') || '20');

  // Fetch stats and events in parallel
  const [statsResponse, eventsResponse] = await Promise.all([
    fetch(
      `${url.origin}/api/plugins/${pluginId}/events/stats`,
      {
        headers: { Cookie: request.headers.get('Cookie') || '' },
      }
    ),
    fetch(
      `${url.origin}/api/plugins/${pluginId}/events?page=${page}&perPage=${perPage}`,
      {
        headers: { Cookie: request.headers.get('Cookie') || '' },
      }
    ),
  ]);

  if (!statsResponse.ok) {
    throw new Response('Failed to fetch stats', { status: statsResponse.status });
  }

  if (!eventsResponse.ok) {
    throw new Response('Failed to fetch events', { status: eventsResponse.status });
  }

  const stats = await statsResponse.json();
  const events = await eventsResponse.json();

  return json({
    plugin: {
      pluginId: plugin.pluginId,
      name: plugin.name,
      key: plugin.key,
    },
    stats,
    events,
  });
}

/**
 * Plugin Data Display Page Component
 */
export default function PluginDataPage() {
  const { plugin, stats, events } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  /**
   * Handle page change
   */
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    navigate(`?${params.toString()}`, { replace: true });
  };

  /**
   * Handle view event detail
   */
  const handleViewDetail = (eventId: string) => {
    setSelectedEventId(eventId);
    setIsModalOpen(true);
  };

  /**
   * Handle close modal
   */
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEventId(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon
                icon="mdi:puzzle"
                className="text-4xl text-blue-600 dark:text-blue-400"
              />
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {plugin.name}
                </h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Plugin event data and statistics
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3">
              <a
                href={`/dashboard/plugins/${plugin.pluginId}/runs`}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Icon icon="mdi:format-list-bulleted" className="text-lg" />
                Execution Logs
              </a>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <EventsStats stats={stats} />

        {/* Events Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Event Data
            </h2>
            {/* Filters will be added here in future */}
          </div>

          <EventsTable events={events.items} onViewDetail={handleViewDetail} />

          {/* Pagination */}
          {events.totalPages > 1 && (
            <Pagination
              currentPage={events.page}
              totalPages={events.totalPages}
              onPageChange={handlePageChange}
            />
          )}

          {/* Empty state hint */}
          {events.total === 0 && (
            <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <Icon
                icon="mdi:information-outline"
                className="mx-auto text-4xl text-gray-400 dark:text-gray-600 mb-2"
              />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No events collected yet. Events will appear here once the plugin starts collecting data.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Event Detail Modal */}
      <EventDetailModal
        isOpen={isModalOpen}
        eventId={selectedEventId}
        pluginId={plugin.pluginId}
        onClose={handleCloseModal}
      />
    </div>
  );
}
