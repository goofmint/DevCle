/**
 * Time Series Chart Component
 *
 * Displays a line chart showing funnel progression over time.
 *
 * Features:
 * - 4 lines (one per stage: awareness, engagement, adoption, advocacy)
 * - Date range selector (daily/weekly/monthly)
 * - Legend
 * - Tooltip showing exact counts
 * - Responsive design
 * - Dark mode support
 * - Accessibility (aria-labels, semantic HTML)
 *
 * Libraries:
 * - recharts: Charting library
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
 * Props for TimeSeriesChart component
 */
interface TimeSeriesChartProps {
  /** Time series data points */
  data: Array<{
    date: string; // YYYY-MM-DD format
    awareness: number;
    engagement: number;
    adoption: number;
    advocacy: number;
  }>;
  /** Current time interval selection */
  interval: 'daily' | 'weekly' | 'monthly';
  /** Callback when interval changes */
  onIntervalChange: (interval: 'daily' | 'weekly' | 'monthly') => void;
}

/**
 * Format date for display on X-axis
 *
 * Converts "YYYY-MM-DD" to "MM/DD" for compact display.
 * Parses the date string component-by-component to avoid timezone shifts.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Formatted date string (MM/DD)
 */
function formatXAxis(dateStr: string): string {
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
    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
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
}

/**
 * Custom Tooltip Component
 *
 * Displays detailed information on hover.
 * Shows date and developer counts for all funnel stages.
 */
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
    payload: {
      date: string;
      awareness: number;
      engagement: number;
      adoption: number;
      advocacy: number;
    };
  }>;
}) {
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

      {/* Stage counts */}
      <div className="space-y-1">
        {/* Awareness */}
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span
            className="
              text-sm
              text-gray-700 dark:text-gray-300
              transition-colors duration-200
            "
          >
            Awareness: {data.awareness.toLocaleString()}
          </span>
        </div>

        {/* Engagement */}
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-cyan-500" />
          <span
            className="
              text-sm
              text-gray-700 dark:text-gray-300
              transition-colors duration-200
            "
          >
            Engagement: {data.engagement.toLocaleString()}
          </span>
        </div>

        {/* Adoption */}
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-teal-500" />
          <span
            className="
              text-sm
              text-gray-700 dark:text-gray-300
              transition-colors duration-200
            "
          >
            Adoption: {data.adoption.toLocaleString()}
          </span>
        </div>

        {/* Advocacy */}
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span
            className="
              text-sm
              text-gray-700 dark:text-gray-300
              transition-colors duration-200
            "
          >
            Advocacy: {data.advocacy.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Time Series Chart Component
 *
 * Renders a line chart showing funnel progression over time.
 * Includes interval selector buttons for daily/weekly/monthly views.
 *
 * Accessibility:
 * - aria-label for chart and controls
 * - role="group" for button group
 * - Keyboard navigation support
 */
export function TimeSeriesChart({
  data,
  interval,
  onIntervalChange,
}: TimeSeriesChartProps) {
  // Handle empty data case
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400"
        data-testid="time-series-chart-empty"
      >
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">No Timeline Data Available</p>
          <p className="text-sm">
            Add activities to see your funnel progression over time
          </p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="time-series-chart">
      {/* Interval Selector */}
      <div className="mb-6 flex justify-end">
        <div
          role="group"
          aria-label="Time interval selector"
          className="inline-flex rounded-md shadow-sm"
        >
          <button
            type="button"
            onClick={() => onIntervalChange('daily')}
            className={`
              px-4 py-2
              text-sm font-medium
              rounded-l-lg
              border
              transition-colors
              ${
                interval === 'daily'
                  ? 'bg-blue-600 text-white border-blue-600 z-10'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }
            `}
            aria-label="Daily view"
            aria-pressed={interval === 'daily'}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => onIntervalChange('weekly')}
            className={`
              px-4 py-2
              text-sm font-medium
              border-t border-b
              transition-colors
              ${
                interval === 'weekly'
                  ? 'bg-blue-600 text-white border-blue-600 z-10'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }
            `}
            style={{
              borderLeftWidth: interval === 'weekly' ? '1px' : '0',
              borderRightWidth: interval === 'weekly' ? '1px' : '0',
              marginLeft: interval === 'weekly' ? '0' : '-1px',
            }}
            aria-label="Weekly view"
            aria-pressed={interval === 'weekly'}
          >
            Weekly
          </button>
          <button
            type="button"
            onClick={() => onIntervalChange('monthly')}
            className={`
              px-4 py-2
              text-sm font-medium
              rounded-r-lg
              border
              transition-colors
              ${
                interval === 'monthly'
                  ? 'bg-blue-600 text-white border-blue-600 z-10'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }
            `}
            style={{
              marginLeft: interval === 'monthly' ? '0' : '-1px',
            }}
            aria-label="Monthly view"
            aria-pressed={interval === 'monthly'}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: 400 }}>
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

            {/* Y-Axis (Developer Count) */}
            <YAxis
              className="text-gray-600 dark:text-gray-400"
              tick={{
                fill: 'currentColor',
                className: 'text-gray-600 dark:text-gray-400',
              }}
              label={{
                value: 'Developers',
                angle: -90,
                position: 'insideLeft',
                style: {
                  textAnchor: 'middle',
                  fill: 'currentColor',
                  className: 'text-gray-600 dark:text-gray-400',
                },
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

            {/* Line: Awareness */}
            <Line
              type="monotone"
              dataKey="awareness"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
              name="Awareness"
            />

            {/* Line: Engagement */}
            <Line
              type="monotone"
              dataKey="engagement"
              stroke="#06b6d4"
              strokeWidth={2}
              dot={{ fill: '#06b6d4', r: 4 }}
              activeDot={{ r: 6 }}
              name="Engagement"
            />

            {/* Line: Adoption */}
            <Line
              type="monotone"
              dataKey="adoption"
              stroke="#14b8a6"
              strokeWidth={2}
              dot={{ fill: '#14b8a6', r: 4 }}
              activeDot={{ r: 6 }}
              name="Adoption"
            />

            {/* Line: Advocacy */}
            <Line
              type="monotone"
              dataKey="advocacy"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: '#10b981', r: 4 }}
              activeDot={{ r: 6 }}
              name="Advocacy"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
