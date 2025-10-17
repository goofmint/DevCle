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

import { type MetaFunction } from '@remix-run/node';
import { useState, useEffect } from 'react';
import {
  UsersIcon,
  ChartBarIcon,
  MegaphoneIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
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
 * Dashboard Overview Component
 *
 * Renders overview page with statistics cards and activity chart.
 * Uses Swapy for drag-and-drop widget reordering.
 * Fetches data client-side via SPA pattern.
 */
export default function DashboardOverview() {
  // State management
  const [stats, setStats] = useState<OverviewData['stats'] | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<OverviewData['timeSeriesData']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data on mount (SPA pattern)
  useEffect(() => {
    async function fetchData() {
      try {
        const [statsResponse, timelineResponse] = await Promise.all([
          fetch('/api/overview/stats'),
          fetch('/api/overview/timeline?days=30'),
        ]);

        if (!statsResponse.ok || !timelineResponse.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        const statsData = await statsResponse.json();
        const timelineData = await timelineResponse.json();

        setStats(statsData.stats);
        setTimeSeriesData(timelineData.timeline);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  // Error state
  if (error || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Error: {error || 'Failed to load data'}</div>
      </div>
    );
  }

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
