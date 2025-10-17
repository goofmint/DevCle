/**
 * StatCard Component
 *
 * Displays a single statistic with icon, label, value, and optional description.
 * Supports dark mode and responsive design.
 *
 * Features:
 * - Icon display (using Heroicons)
 * - Label and value display
 * - Optional description text
 * - Optional trend indicator (percentage up/down)
 * - Dark mode support via Tailwind classes
 * - Accessible with proper ARIA attributes
 *
 * Usage:
 * ```typescript
 * <StatCard
 *   testId="total-developers"
 *   label="Total Developers"
 *   value={1234}
 *   icon={UsersIcon}
 *   description="Active contributors"
 * />
 * ```
 */

import React from 'react';

/**
 * StatCard Props
 *
 * Configuration for StatCard component.
 */
export interface StatCardProps {
  /** Test ID for E2E testing (optional) */
  testId?: string;
  /** Label text (e.g., "Total Developers") */
  label: string;
  /** Value to display (number or formatted string) */
  value: string | number;
  /** Icon component from Heroicons (or any SVG component) */
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** Optional description text below value */
  description?: string;
  /** Optional trend indicator (percentage change) */
  trend?: {
    /** Percentage value (e.g., 12.5 for +12.5%) */
    value: number;
    /** Whether trend is positive (green) or negative (red) */
    isPositive: boolean;
  };
}

/**
 * StatCard Component
 *
 * Renders a card displaying a statistic with icon, label, and value.
 * Includes dark mode support and optional trend indicator.
 *
 * @param props - StatCard props
 * @returns StatCard JSX element
 */
export function StatCard({
  testId,
  label,
  value,
  icon: Icon,
  description,
  trend,
}: StatCardProps): JSX.Element {
  return (
    <div
      className="
        bg-white dark:bg-gray-800
        p-6 rounded-lg shadow
        border border-gray-200 dark:border-gray-700
        transition-colors duration-200
      "
      data-testid={testId}
    >
      {/* Header: Icon and Label */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {/* Icon Container */}
          <div
            className="
              p-2 rounded-lg
              bg-indigo-100 dark:bg-indigo-900
              transition-colors duration-200
            "
          >
            <Icon
              className="
                w-6 h-6
                text-indigo-600 dark:text-indigo-400
                transition-colors duration-200
              "
              aria-hidden="true"
            />
          </div>

          {/* Label */}
          <h3
            className="
              text-sm font-medium
              text-gray-600 dark:text-gray-400
              transition-colors duration-200
            "
          >
            {label}
          </h3>
        </div>

        {/* Trend Indicator (optional) */}
        {trend && (
          <span
            className={`
              text-sm font-medium
              ${trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
              transition-colors duration-200
            `}
            aria-label={`Trend: ${trend.isPositive ? 'up' : 'down'} ${Math.abs(trend.value)}%`}
          >
            {trend.isPositive ? '+' : ''}
            {trend.value.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Value */}
      <div className="mb-2">
        <p
          className="
            text-3xl font-bold
            text-gray-900 dark:text-white
            transition-colors duration-200
          "
          data-testid={testId ? `${testId}-value` : undefined}
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      </div>

      {/* Description (optional) */}
      {description && (
        <p
          className="
            text-sm
            text-gray-500 dark:text-gray-400
            transition-colors duration-200
          "
        >
          {description}
        </p>
      )}
    </div>
  );
}
