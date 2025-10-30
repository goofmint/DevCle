/**
 * Events Statistics Component
 *
 * Displays aggregated statistics for plugin events in card format.
 */

import { Icon } from '@iconify/react';
import type { EventsStats } from '../../../services/plugin-events/index.js';

interface EventsStatsProps {
  stats: EventsStats;
}

export function EventsStats({ stats }: EventsStatsProps) {
  // Calculate percentages
  const processedPercent = stats.total > 0
    ? ((stats.processed / stats.total) * 100).toFixed(1)
    : '0.0';
  const failedPercent = stats.total > 0
    ? ((stats.failed / stats.total) * 100).toFixed(1)
    : '0.0';
  const pendingPercent = stats.total > 0
    ? ((stats.pending / stats.total) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Events */}
      <StatCard
        icon="mdi:database"
        label="Total Events"
        value={stats.total.toLocaleString()}
        className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
        iconClassName="text-blue-600 dark:text-blue-400"
      />

      {/* Processed */}
      <StatCard
        icon="mdi:check-circle"
        label="Processed"
        value={stats.processed.toLocaleString()}
        percentage={`${processedPercent}%`}
        className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
        iconClassName="text-green-600 dark:text-green-400"
      />

      {/* Failed */}
      <StatCard
        icon="mdi:alert-circle"
        label="Failed"
        value={stats.failed.toLocaleString()}
        percentage={`${failedPercent}%`}
        className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
        iconClassName="text-red-600 dark:text-red-400"
      />

      {/* Pending */}
      <StatCard
        icon="mdi:clock-outline"
        label="Pending"
        value={stats.pending.toLocaleString()}
        percentage={`${pendingPercent}%`}
        className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
        iconClassName="text-yellow-600 dark:text-yellow-400"
      />
    </div>
  );
}

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  percentage?: string;
  className?: string;
  iconClassName?: string;
}

function StatCard({
  icon,
  label,
  value,
  percentage,
  className = '',
  iconClassName = '',
}: StatCardProps) {
  return (
    <div
      className={`
        rounded-lg border p-4
        bg-white dark:bg-gray-800
        ${className}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {label}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {value}
            </p>
            {percentage && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                ({percentage})
              </p>
            )}
          </div>
        </div>
        <Icon icon={icon} className={`text-3xl ${iconClassName}`} />
      </div>
    </div>
  );
}
