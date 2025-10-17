/**
 * Dashboard Overview Page
 *
 * Displays dashboard overview with key metrics and activity timeline.
 * Accessible at: /dashboard
 *
 * Features:
 * - Key metrics cards (developers, activities, campaigns, ROI)
 * - Activity timeline chart (Recharts)
 * - Drag-and-drop widget reordering (Swapy)
 * - Dark mode support
 * - Responsive design (mobile/tablet/desktop)
 *
 * Architecture:
 * - Loader: Fetches stats and timeline from API
 * - Components: StatCard, ActivityChart, SwapyContainer
 * - Layout: 4-column grid for stats, full-width chart
 */

import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import {
  UsersIcon,
  ChartBarIcon,
  MegaphoneIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import { requireAuth } from '~/auth.middleware.js';
import { StatCard } from '~/components/dashboard/StatCard.js';
import { ActivityChart } from '~/components/dashboard/ActivityChart.js';
import { SwapyContainer } from '~/components/dashboard/SwapyContainer.js';

/**
 * Meta function - Sets page title
 */
export const meta: MetaFunction = () => {
  return [
    { title: 'Overview - Dashboard - DevCle' },
    { name: 'description', content: 'Dashboard overview with key metrics' },
  ];
};

/**
 * Overview Data Type
 *
 * Data structure returned by loader.
 */
interface OverviewData {
  stats: {
    totalDevelopers: number;
    totalActivities: number;
    totalCampaigns: number;
    averageROI: number | null;
  };
  timeSeriesData: Array<{
    date: string;
    activities: number;
    developers: number;
  }>;
}

/**
 * Loader Function
 *
 * Fetches overview statistics and timeline data from API.
 * Runs on server-side before rendering the page.
 *
 * Steps:
 * 1. Authenticate user (requireAuth throws redirect if not authenticated)
 * 2. Fetch stats from /api/overview/stats
 * 3. Fetch timeline from /api/overview/timeline
 * 4. Return data to component
 *
 * @param request - Remix loader request
 * @returns JSON response with stats and timeline data
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // 1. Authenticate user (required by parent dashboard.tsx, but double-check here)
  await requireAuth(request);

  try {
    // 2. Fetch stats and timeline data from API (parallel requests)
    // Use internal API endpoints (server-to-server)
    const [statsResponse, timelineResponse] = await Promise.all([
      fetch(new URL('/api/overview/stats', request.url), {
        headers: { Cookie: request.headers.get('Cookie') || '' },
      }),
      fetch(new URL('/api/overview/timeline?days=30', request.url), {
        headers: { Cookie: request.headers.get('Cookie') || '' },
      }),
    ]);

    // 3. Check response status
    if (!statsResponse.ok) {
      throw new Error(
        `Failed to fetch stats: ${statsResponse.status} ${statsResponse.statusText}`
      );
    }
    if (!timelineResponse.ok) {
      throw new Error(
        `Failed to fetch timeline: ${timelineResponse.status} ${timelineResponse.statusText}`
      );
    }

    // 4. Parse JSON responses
    const stats = await statsResponse.json();
    const timeline = await timelineResponse.json();

    // 5. Validate response structure
    if (!stats?.stats) {
      throw new Error('Invalid stats response structure');
    }
    if (!Array.isArray(timeline?.timeline)) {
      throw new Error('Invalid timeline response structure');
    }

    // 6. Return data to component
    return json<OverviewData>({
      stats: stats.stats,
      timeSeriesData: timeline.timeline,
    });
  } catch (error) {
    // Log error for debugging
    console.error('Overview loader error:', error);

    // Re-throw as Response for Remix ErrorBoundary
    throw new Response('Failed to load overview data', {
      status: 500,
      statusText: error instanceof Error ? error.message : 'Internal Server Error',
    });
  }
}

/**
 * Dashboard Overview Component
 *
 * Renders overview page with statistics cards and activity chart.
 * Uses Swapy for drag-and-drop widget reordering.
 */
export default function DashboardOverview() {
  // Get data from loader
  const { stats, timeSeriesData } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Overview
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Key metrics and insights for your DevRel activities
        </p>
      </div>

      {/* Stats Grid with Swapy Drag-and-Drop */}
      <SwapyContainer storageKey="overview-stats-layout" animation="dynamic">
        {/* Grid: 4 columns on desktop, 2 on tablet, 1 on mobile */}
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {/* Stat Card 1: Total Developers */}
          <div data-swapy-slot="slot-1">
            <div data-swapy-item="item-1">
              <StatCard
                testId="total-developers"
                label="Total Developers"
                value={stats.totalDevelopers}
                icon={UsersIcon}
                description="Registered developers"
              />
            </div>
          </div>

          {/* Stat Card 2: Total Activities */}
          <div data-swapy-slot="slot-2">
            <div data-swapy-item="item-2">
              <StatCard
                testId="total-activities"
                label="Total Activities"
                value={stats.totalActivities}
                icon={ChartBarIcon}
                description="All tracked activities"
              />
            </div>
          </div>

          {/* Stat Card 3: Active Campaigns */}
          <div data-swapy-slot="slot-3">
            <div data-swapy-item="item-3">
              <StatCard
                testId="total-campaigns"
                label="Active Campaigns"
                value={stats.totalCampaigns}
                icon={MegaphoneIcon}
                description="Running campaigns"
              />
            </div>
          </div>

          {/* Stat Card 4: Average ROI */}
          <div data-swapy-slot="slot-4">
            <div data-swapy-item="item-4">
              <StatCard
                testId="average-roi"
                label="Average ROI"
                value={
                  stats.averageROI !== null
                    ? `${stats.averageROI.toFixed(1)}%`
                    : 'N/A'
                }
                icon={CurrencyDollarIcon}
                description="Campaign ROI average"
              />
            </div>
          </div>
        </div>
      </SwapyContainer>

      {/* Activity Timeline Chart */}
      <ActivityChart data={timeSeriesData} height={300} />
    </div>
  );
}
