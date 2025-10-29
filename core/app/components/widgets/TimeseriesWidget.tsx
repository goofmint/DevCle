/**
 * Timeseries Widget Component
 *
 * Displays time-series data as a line chart using Recharts.
 * Supports multiple series on the same chart with automatic color assignment.
 *
 * Features:
 * - Line chart with responsive container
 * - Multiple data series support
 * - Automatic date grouping and merging
 * - Loading state with animated skeleton
 * - Error state with error message
 * - Dark mode support with appropriate colors
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { CHART_COLORS } from './constants.js';
import type { TimeseriesWidgetData } from '~/types/widget-api.js';

/**
 * Timeseries widget props
 */
interface TimeseriesWidgetProps {
  /** Widget data */
  data: TimeseriesWidgetData;

  /** Loading state (shows skeleton) */
  isLoading?: boolean;

  /** Error state (shows error message) */
  isError?: boolean;

  /** Error message to display */
  errorMessage?: string;
}

/**
 * Transform timeseries data to Recharts format
 *
 * Merges multiple series by date and creates a format compatible with Recharts.
 * Each series becomes a property in the output objects.
 *
 * @param series - Array of series with label and points
 * @returns Array of data points in Recharts format
 *
 * @example
 * Input: [
 *   { label: "PRs", points: [["2025-10-01", 5], ["2025-10-02", 7]] },
 *   { label: "Issues", points: [["2025-10-01", 3], ["2025-10-02", 4]] }
 * ]
 *
 * Output: [
 *   { date: "2025-10-01", PRs: 5, Issues: 3 },
 *   { date: "2025-10-02", PRs: 7, Issues: 4 }
 * ]
 */
function transformToChartData(
  series: Array<{ label: string; points: Array<[string, number]> }>
): Array<{ date: string; [seriesLabel: string]: string | number }> {
  // Step 1: Collect all unique dates from all series
  const allDates = new Set<string>();
  for (const s of series) {
    for (const [date] of s.points) {
      allDates.add(date);
    }
  }

  // Step 2: Sort dates chronologically
  const sortedDates = Array.from(allDates).sort();

  // Step 3: For each date, merge all series values
  return sortedDates.map((date) => {
    const dataPoint: { date: string; [key: string]: string | number } = {
      date,
    };

    // Add each series value for this date
    for (const s of series) {
      const point = s.points.find(([d]) => d === date);
      dataPoint[s.label] = point ? point[1] : 0; // Default to 0 if no data
    }

    return dataPoint;
  });
}

/**
 * TimeseriesWidget Component
 *
 * Renders a timeseries widget with a line chart.
 */
export function TimeseriesWidget({
  data,
  isLoading,
  isError,
  errorMessage,
}: TimeseriesWidgetProps) {
  // Loading state: Show skeleton placeholder
  if (isLoading) {
    return (
      <div className="h-full p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4 animate-pulse" />
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  // Error state: Show error message
  if (isError) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
          {data.title}
        </h3>
        <p className="text-sm text-red-700 dark:text-red-300">
          {errorMessage || 'Failed to load chart data'}
        </p>
      </div>
    );
  }

  // Transform data to Recharts format
  const chartData = transformToChartData(data.data.series);

  // Success state: Show actual chart
  return (
    <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {data.title}
      </h3>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-gray-200 dark:stroke-gray-700"
          />
          <XAxis
            dataKey="date"
            className="text-xs text-gray-600 dark:text-gray-400"
          />
          <YAxis className="text-xs text-gray-600 dark:text-gray-400" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
            }}
          />
          <Legend />
          {data.data.series.map((series, index) => (
            <Line
              key={series.label}
              type="monotone"
              dataKey={series.label}
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
