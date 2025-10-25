/**
 * Drop Rate Card Component
 *
 * Displays the drop rate between two funnel stages.
 *
 * Features:
 * - Previous stage name
 * - Current stage name
 * - Drop rate percentage
 * - Visual indicator (color: red for high drop, yellow for medium, green for low)
 * - Icon indicating direction (down arrow)
 * - Dark mode support
 * - Accessibility (aria-labels, semantic HTML)
 *
 * Drop Rate Calculation:
 * dropRate = (previousCount - currentCount) / previousCount * 100
 *
 * Color Thresholds:
 * - High drop rate (>70%): red
 * - Medium drop rate (30-70%): yellow
 * - Low drop rate (<30%): green
 */

import { Icon } from '@iconify/react';

/**
 * Props for DropRateCard component
 */
interface DropRateCardProps {
  /** Name of the previous funnel stage */
  fromStage: string;
  /** Name of the current funnel stage */
  toStage: string;
  /** Drop rate as percentage (0-100) */
  dropRate: number;
}

/**
 * Get color scheme based on drop rate value
 *
 * Returns Tailwind CSS classes for background, text, and icon colors.
 * Higher drop rates (bad) are red, lower drop rates (good) are green.
 *
 * @param dropRate - Drop rate percentage (0-100)
 * @returns Object with color classes for different elements
 */
function getDropRateColors(dropRate: number): {
  bg: string;
  text: string;
  icon: string;
  border: string;
} {
  if (dropRate > 70) {
    // High drop rate (bad) - red theme
    return {
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-900 dark:text-red-100',
      icon: 'text-red-600 dark:text-red-400',
      border: 'border-red-200 dark:border-red-800',
    };
  }

  if (dropRate > 30) {
    // Medium drop rate (neutral) - yellow theme
    return {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      text: 'text-yellow-900 dark:text-yellow-100',
      icon: 'text-yellow-600 dark:text-yellow-400',
      border: 'border-yellow-200 dark:border-yellow-800',
    };
  }

  // Low drop rate (good) - green theme
  return {
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-900 dark:text-green-100',
    icon: 'text-green-600 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
  };
}

/**
 * Get severity label for drop rate
 *
 * Returns a human-readable label describing the drop rate severity.
 *
 * @param dropRate - Drop rate percentage (0-100)
 * @returns Severity label string
 */
function getSeverityLabel(dropRate: number): string {
  if (dropRate > 70) {
    return 'High Drop Rate';
  }
  if (dropRate > 30) {
    return 'Moderate Drop Rate';
  }
  return 'Low Drop Rate';
}

/**
 * Drop Rate Card Component
 *
 * Renders a card displaying the drop rate between two funnel stages.
 * Color-coded based on severity (high/medium/low).
 *
 * Accessibility:
 * - aria-label for screen readers
 * - role="region" for semantic HTML
 * - High contrast colors for visibility
 */
export function DropRateCard({ fromStage, toStage, dropRate }: DropRateCardProps) {
  // Get color scheme based on drop rate
  const colors = getDropRateColors(dropRate);
  const severityLabel = getSeverityLabel(dropRate);

  return (
    <div
      className={`
        rounded-lg
        border
        ${colors.border}
        ${colors.bg}
        p-6
        transition-all
        duration-300
        hover:shadow-lg
      `}
      role="region"
      aria-label={`Drop rate from ${fromStage} to ${toStage}: ${dropRate.toFixed(1)}%`}
      data-testid="drop-rate-card"
    >
      {/* Stage transition label */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {fromStage}
          </p>
          <div className="flex items-center my-1">
            <Icon
              icon="heroicons:arrow-down-20-solid"
              className={`w-4 h-4 ${colors.icon}`}
              aria-hidden="true"
            />
          </div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {toStage}
          </p>
        </div>

        {/* Drop rate indicator */}
        <div className="flex-shrink-0">
          <div
            className={`
              w-16 h-16
              rounded-full
              flex
              items-center
              justify-center
              ${colors.icon}
              bg-white
              dark:bg-gray-800
              shadow-inner
            `}
            aria-hidden="true"
          >
            <Icon icon="heroicons:arrow-trending-down" className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Drop rate percentage */}
      <div className="mb-2">
        <p className={`text-4xl font-bold ${colors.text}`}>
          {dropRate.toFixed(1)}%
        </p>
      </div>

      {/* Severity label */}
      <div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {severityLabel}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          {dropRate > 70
            ? 'Consider improving engagement strategies'
            : dropRate > 30
            ? 'Moderate conversion, room for improvement'
            : 'Good conversion rate'}
        </p>
      </div>
    </div>
  );
}
