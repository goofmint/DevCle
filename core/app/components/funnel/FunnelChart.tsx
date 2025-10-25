/**
 * Funnel Chart Component
 *
 * Displays a funnel visualization showing the flow of developers through 4 stages.
 * Uses a custom implementation with horizontal bars (not recharts Funnel component).
 *
 * Features:
 * - Funnel bars with width proportional to developer count
 * - Stage labels and counts
 * - Color coding (gradient from blue to green)
 * - Responsive design (mobile/desktop)
 * - Dark mode support
 * - Accessibility (aria-labels, keyboard navigation)
 *
 * Color Scheme:
 * - Awareness: blue-500
 * - Engagement: cyan-500
 * - Adoption: teal-500
 * - Advocacy: green-500
 */

/**
 * Props for FunnelChart component
 */
interface FunnelChartProps {
  /** Funnel stage data with counts */
  data: Array<{
    stage: string;
    stageName: string;
    count: number;
  }>;
}

/**
 * Stage color mapping for funnel visualization
 *
 * Maps stage keys to Tailwind CSS color classes for visual hierarchy.
 */
const STAGE_COLORS: Record<string, { bg: string; text: string; darkBg: string }> = {
  awareness: {
    bg: 'bg-blue-500',
    text: 'text-blue-700',
    darkBg: 'dark:bg-blue-600',
  },
  engagement: {
    bg: 'bg-cyan-500',
    text: 'text-cyan-700',
    darkBg: 'dark:bg-cyan-600',
  },
  adoption: {
    bg: 'bg-teal-500',
    text: 'text-teal-700',
    darkBg: 'dark:bg-teal-600',
  },
  advocacy: {
    bg: 'bg-green-500',
    text: 'text-green-700',
    darkBg: 'dark:bg-green-600',
  },
};

/**
 * Funnel Chart Component
 *
 * Renders a funnel visualization using horizontal bars.
 * Each bar's width is proportional to the developer count.
 * Bars are centered and stacked vertically with spacing.
 *
 * Accessibility:
 * - aria-label for screen readers
 * - role="img" for semantic HTML
 * - High contrast colors for visibility
 */
export function FunnelChart({ data }: FunnelChartProps) {
  // Find max count for width calculation (100% width)
  const maxCount = Math.max(...data.map((d) => d.count));

  // Handle empty data case
  if (data.length === 0 || maxCount === 0) {
    return (
      <div
        className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400"
        data-testid="funnel-chart-empty"
      >
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">No Data Available</p>
          <p className="text-sm">
            Add activities to see your developer funnel visualization
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="py-8"
      role="img"
      aria-label="Developer funnel chart showing progression through four stages"
      data-testid="funnel-chart"
    >
      {/* Funnel stages visualization */}
      <div className="space-y-4">
        {data.map((stage, index) => {
          // All stages have the same width (80% of container for consistent visual appearance)
          const widthPercent = 80;

          // Get color scheme for this stage
          const colors = STAGE_COLORS[stage.stage] || STAGE_COLORS['awareness'];

          return (
            <div
              key={stage.stage}
              className="flex flex-col items-center"
              data-testid={`funnel-stage-${stage.stage}`}
            >
              {/* Stage bar with count */}
              <div
                className={`
                  relative
                  ${colors?.bg || 'bg-blue-500'}
                  ${colors?.darkBg || 'dark:bg-blue-600'}
                  text-white
                  rounded-lg
                  py-6
                  px-4
                  shadow-md
                  transition-all
                  duration-300
                  hover:shadow-lg
                  hover:scale-105
                `}
                style={{ width: `${widthPercent}%` }}
                aria-label={`${stage.stageName}: ${stage.count} developers`}
              >
                {/* Stage name */}
                <div className="text-center">
                  <p className="text-sm font-medium uppercase tracking-wide mb-1">
                    {stage.stageName}
                  </p>
                  {/* Developer count */}
                  <p className="text-3xl font-bold">
                    {stage.count.toLocaleString()}
                  </p>
                  <p className="text-xs mt-1 opacity-90">
                    {maxCount > 0 ? ((stage.count / maxCount) * 100).toFixed(0) : '0'}% of total
                  </p>
                </div>
              </div>

              {/* Arrow indicator between stages (not shown for last stage) */}
              {index < data.length - 1 && (
                <div className="my-2">
                  <svg
                    className="w-6 h-6 text-gray-400 dark:text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend for color coding */}
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Stage Definitions:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div className="flex items-start">
            <span className="flex-shrink-0 w-3 h-3 bg-blue-500 dark:bg-blue-600 rounded-full mt-1 mr-2"></span>
            <div>
              <span className="font-medium text-gray-900 dark:text-white">Awareness:</span>
              <span className="text-gray-600 dark:text-gray-400 ml-1">
                First contact with product/community
              </span>
            </div>
          </div>
          <div className="flex items-start">
            <span className="flex-shrink-0 w-3 h-3 bg-cyan-500 dark:bg-cyan-600 rounded-full mt-1 mr-2"></span>
            <div>
              <span className="font-medium text-gray-900 dark:text-white">Engagement:</span>
              <span className="text-gray-600 dark:text-gray-400 ml-1">
                Active participation (posts, events)
              </span>
            </div>
          </div>
          <div className="flex items-start">
            <span className="flex-shrink-0 w-3 h-3 bg-teal-500 dark:bg-teal-600 rounded-full mt-1 mr-2"></span>
            <div>
              <span className="font-medium text-gray-900 dark:text-white">Adoption:</span>
              <span className="text-gray-600 dark:text-gray-400 ml-1">
                Product usage, API calls
              </span>
            </div>
          </div>
          <div className="flex items-start">
            <span className="flex-shrink-0 w-3 h-3 bg-green-500 dark:bg-green-600 rounded-full mt-1 mr-2"></span>
            <div>
              <span className="font-medium text-gray-900 dark:text-white">Advocacy:</span>
              <span className="text-gray-600 dark:text-gray-400 ml-1">
                Evangelism, content creation
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
