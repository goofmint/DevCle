/**
 * Events Statistics Component
 *
 * Displays summary statistics for plugin events in a grid of cards.
 * Shows total, processed, failed, pending counts, processing rate, and error rate.
 *
 * Features:
 * - Responsive grid layout (1 col mobile, 3 col tablet, 6 col desktop)
 * - Color-coded values (success: green, failed: red, pending: yellow)
 * - Loading skeleton state
 * - Dark mode support
 */

import { Icon } from '@iconify/react';
import type { EventsStats } from '~/types/plugin-events';

interface EventsStatsProps {
  stats: EventsStats | null;
  loading?: boolean;
}


/**
 * Stat Card Component
 *
 * Individual card displaying a single statistic.
 */
interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  colorClass: string;
  loading?: boolean;
}

function StatCard({ icon, label, value, colorClass, loading }: StatCardProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="animate-pulse">
          <div className="h-5 w-5 bg-gray-300 dark:bg-gray-600 rounded mb-2" />
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24 mb-2" />
          <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-16" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center mb-2">
        <Icon
          icon={icon}
          className={`w-5 h-5 ${colorClass}`}
          aria-hidden="true"
        />
        <span className="ml-2 text-sm font-medium text-gray-600 dark:text-gray-400">
          {label}
        </span>
      </div>
      <div className={`text-2xl font-bold ${colorClass}`}>
        {value}
      </div>
    </div>
  );
}

/**
 * Events Statistics Component
 */
export function EventsStats({ stats, loading = false }: EventsStatsProps) {
  const isLoading = loading || stats === null;

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6"
      data-testid="events-stats"
    >
      <StatCard
        icon="mdi:database"
        label="Total Events"
        value={stats?.total ?? 0}
        colorClass="text-blue-600 dark:text-blue-400"
        loading={isLoading}
      />

      <StatCard
        icon="mdi:check-circle"
        label="Processed"
        value={stats?.processed ?? 0}
        colorClass="text-green-600 dark:text-green-400"
        loading={isLoading}
      />

      <StatCard
        icon="mdi:alert-circle"
        label="Failed"
        value={stats?.failed ?? 0}
        colorClass="text-red-600 dark:text-red-400"
        loading={isLoading}
      />

      <StatCard
        icon="mdi:clock-outline"
        label="Pending"
        value={stats?.pending ?? 0}
        colorClass="text-yellow-600 dark:text-yellow-400"
        loading={isLoading}
      />

      <StatCard
        icon="mdi:chart-line"
        label="Processing Rate (%)"
        value={`${stats?.processingRate?.toFixed(1) ?? '0.0'}%`}
        colorClass="text-purple-600 dark:text-purple-400"
        loading={isLoading}
      />

      <StatCard
        icon="mdi:alert-octagon"
        label="Error Rate (%)"
        value={`${stats?.errorRate?.toFixed(1) ?? '0.0'}%`}
        colorClass="text-orange-600 dark:text-orange-400"
        loading={isLoading}
      />
    </div>
  );
}
