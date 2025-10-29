/**
 * Summary Card Component
 *
 * Displays a summary metric with an icon and value.
 * Used for showing plugin run statistics.
 */

import { Icon } from '@iconify/react';

/**
 * Summary Card Props
 */
interface SummaryCardProps {
  /** Card label */
  label: string;
  /** Numeric value to display */
  value: number;
  /** Iconify icon name */
  icon: string;
  /** Color theme */
  color: 'gray' | 'green' | 'red' | 'blue' | 'purple';
}

/**
 * Summary Card Component
 *
 * Renders a card with an icon, label, and numeric value.
 * Supports multiple color themes for different metric types.
 *
 * @param label - Card label
 * @param value - Numeric value to display
 * @param icon - Iconify icon name
 * @param color - Color theme
 */
export function SummaryCard({ label, value, icon, color }: SummaryCardProps) {
  const colorClasses = {
    gray: 'text-gray-600 dark:text-gray-400',
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
  };

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
      data-testid={`summary-card-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon icon={icon} className={`w-5 h-5 ${colorClasses[color]}`} />
        <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  );
}
