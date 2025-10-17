/**
 * ActivityChart Component
 *
 * Displays time-series data for activities and developers using Recharts.
 * Shows two lines: total activities and unique developers per day.
 *
 * Features:
 * - Dual-line chart (activities and developers)
 * - Responsive design (adapts to container width)
 * - Dark mode support
 * - Interactive tooltip
 * - Date formatting on X-axis
 *
 * Usage:
 * ```typescript
 * <ActivityChart
 *   data={[
 *     { date: '2025-10-01', activities: 120, developers: 45 },
 *     { date: '2025-10-02', activities: 98, developers: 38 },
 *   ]}
 *   height={300}
 * />
 * ```
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

/**
 * Timeline Data Point
 *
 * Single data point for time-series chart.
 */
export interface TimeSeriesDataPoint {
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Number of activities on this date */
  activities: number;
  /** Number of unique developers on this date */
  developers: number;
}

/**
 * ActivityChart Props
 *
 * Configuration for ActivityChart component.
 */
export interface ActivityChartProps {
  /** Array of time-series data points */
  data: TimeSeriesDataPoint[];
  /** Chart height in pixels (default: 300) */
  height?: number;
}

/**
 * ActivityChart Component
 *
 * Renders a line chart showing activities and developers over time.
 * Uses Recharts library for visualization.
 *
 * @param props - ActivityChart props
 * @returns ActivityChart JSX element
 */
export function ActivityChart({
  data,
}: ActivityChartProps): JSX.Element {
  /**
   * Format date for display on X-axis
   *
   * Converts "YYYY-MM-DD" to "MM/DD" for compact display.
   * Parses the date string component-by-component to avoid timezone shifts.
   *
   * @param dateStr - Date string in YYYY-MM-DD format
   * @returns Formatted date string (MM/DD)
   */
  const formatXAxis = (dateStr: string): string => {
    try {
      // Split "YYYY-MM-DD" into components to avoid timezone parsing issues
      const parts = dateStr.split('-');
      if (parts.length !== 3) {
        return dateStr; // Invalid format, return original
      }

      const year = parseInt(parts[0] || '0', 10);
      const month = parseInt(parts[1] || '0', 10);
      const day = parseInt(parts[2] || '0', 10);

      // Validate components
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        return dateStr; // Invalid numbers, return original
      }

      if (month < 1 || month > 12 || day < 1 || day > 31) {
        return dateStr; // Out of range, return original
      }

      // Create date from components (month is 0-indexed in Date constructor)
      const date = new Date(year, month - 1, day);

      // Derive month and day from the constructed Date
      const displayMonth = date.getMonth() + 1; // 0-indexed, so +1
      const displayDay = date.getDate();

      return `${displayMonth}/${displayDay}`;
    } catch {
      return dateStr;
    }
  };

  /**
   * Custom Tooltip Component
   *
   * Displays detailed information on hover.
   * Shows date, activities, and developers.
   */
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{
      value: number;
      dataKey: string;
      color: string;
      payload: TimeSeriesDataPoint;
    }>;
  }) => {
    if (!active || !payload || payload.length === 0) {
      return null;
    }

    const data = payload[0]?.payload;
    if (!data) return null;

    return (
      <div
        className="
          bg-white dark:bg-gray-800
          border border-gray-200 dark:border-gray-700
          rounded-lg shadow-lg p-3
          transition-colors duration-200
        "
      >
        {/* Date */}
        <p
          className="
            text-sm font-medium mb-2
            text-gray-900 dark:text-white
            transition-colors duration-200
          "
        >
          {data.date}
        </p>

        {/* Activities */}
        <div className="flex items-center space-x-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-indigo-500" />
          <span
            className="
              text-sm
              text-gray-700 dark:text-gray-300
              transition-colors duration-200
            "
          >
            Activities: {data.activities.toLocaleString()}
          </span>
        </div>

        {/* Developers */}
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span
            className="
              text-sm
              text-gray-700 dark:text-gray-300
              transition-colors duration-200
            "
          >
            Developers: {data.developers.toLocaleString()}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      className="
        h-full
        bg-white dark:bg-gray-800
        p-6 rounded-lg shadow
        border border-gray-200 dark:border-gray-700
        transition-colors duration-200
        flex flex-col
      "
      data-testid="activity-chart"
    >
      {/* Chart Title */}
      <h3
        className="
          text-lg font-semibold mb-4
          text-gray-900 dark:text-white
          transition-colors duration-200
        "
      >
        Activity Timeline
      </h3>

      {/* Chart Container */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          {/* Grid */}
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-gray-200 dark:stroke-gray-700"
          />

          {/* X-Axis (Date) */}
          <XAxis
            dataKey="date"
            tickFormatter={formatXAxis}
            className="text-gray-600 dark:text-gray-400"
            tick={{
              fill: 'currentColor',
              className: 'text-gray-600 dark:text-gray-400',
            }}
          />

          {/* Y-Axis (Count) */}
          <YAxis
            className="text-gray-600 dark:text-gray-400"
            tick={{
              fill: 'currentColor',
              className: 'text-gray-600 dark:text-gray-400',
            }}
          />

          {/* Tooltip */}
          <Tooltip content={<CustomTooltip />} />

          {/* Legend */}
          <Legend
            wrapperStyle={{
              paddingTop: '20px',
            }}
            iconType="line"
          />

          {/* Line: Activities */}
          <Line
            type="monotone"
            dataKey="activities"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ fill: '#6366f1', r: 4 }}
            activeDot={{ r: 6 }}
            name="Activities"
          />

          {/* Line: Developers */}
          <Line
            type="monotone"
            dataKey="developers"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: '#10b981', r: 4 }}
            activeDot={{ r: 6 }}
            name="Developers"
          />
        </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
