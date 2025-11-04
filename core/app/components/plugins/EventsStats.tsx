/**
 * Events Statistics Component
 *
 * Displays summary statistics for plugin events in a grid of cards.
 * Shows total, processed, failed, pending counts, and latest/oldest timestamps.
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
 * Format timestamp for display
 *
 * @param isoTimestamp - ISO timestamp string
 * @returns Formatted date string (YYYY-MM-DD HH:mm:ss) or "—"
 */
function formatTimestamp(isoTimestamp: string | null): string {
  if (!isoTimestamp) return '—';

  try {
    const date = new Date(isoTimestamp);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date).replace(/(\d+)\/(\d+)\/(\d+),/, '$3-$1-$2');
  } catch {
    return '—';
  }
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
        icon="mdi:arrow-up"
        label="Latest"
        value={formatTimestamp(stats?.latestIngestedAt ?? null)}
        colorClass="text-purple-600 dark:text-purple-400"
        loading={isLoading}
      />

      <StatCard
        icon="mdi:arrow-down"
        label="Oldest"
        value={formatTimestamp(stats?.oldestIngestedAt ?? null)}
        colorClass="text-gray-600 dark:text-gray-400"
        loading={isLoading}
      />
    </div>
  );
}
