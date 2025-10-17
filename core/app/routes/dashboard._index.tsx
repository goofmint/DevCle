/**
 * Dashboard Overview Page
 *
 * Displays overview of key metrics and statistics.
 * Accessible at: /dashboard
 *
 * Authentication:
 * - Authentication is handled by parent route (dashboard.tsx)
 * - No loader needed here
 *
 * Features:
 * - Key metrics cards (developers, activities, campaigns)
 * - Recent activity summary
 * - Dark mode support
 * - Responsive design
 *
 * Note:
 * - This is a placeholder implementation
 * - Task 7.2 will add real data from API
 */

/**
 * Dashboard Overview Component
 *
 * Displays key metrics and recent activity.
 * This is a placeholder - real data will be fetched in Task 7.2.
 */
export default function DashboardOverview() {
  // Placeholder data
  // Task 7.2 will replace this with real data from API
  const stats = [
    {
      key: 'developers',
      label: 'Total Developers',
      value: '1,234',
      change: '+12.5%',
      changeType: 'increase' as const,
    },
    {
      key: 'activities',
      label: 'Activities (30 days)',
      value: '5,678',
      change: '+8.2%',
      changeType: 'increase' as const,
    },
    {
      key: 'campaigns',
      label: 'Active Campaigns',
      value: '12',
      change: '-2',
      changeType: 'decrease' as const,
    },
    {
      key: 'conversion',
      label: 'Conversion Rate',
      value: '23.4%',
      change: '+3.1%',
      changeType: 'increase' as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Overview
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Key metrics and insights for your DevRel activities
        </p>
      </div>

      {/* Stats Grid */}
      <div
        className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        data-testid="stats-grid"
      >
        {stats.map((stat) => (
          <StatCard key={stat.key} stat={stat} />
        ))}
      </div>

      {/* Recent Activity Section (Placeholder) */}
      <div
        className="
          bg-white dark:bg-gray-800
          border border-gray-200 dark:border-gray-700
          rounded-lg p-6
        "
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Activity
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No recent activity. Activity data will be displayed here in Task 7.2.
        </p>
      </div>

      {/* Quick Actions Section (Placeholder) */}
      <div
        className="
          bg-white dark:bg-gray-800
          border border-gray-200 dark:border-gray-700
          rounded-lg p-6
        "
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <QuickActionButton
            label="Add Developer"
            description="Register a new developer"
          />
          <QuickActionButton
            label="Create Campaign"
            description="Launch a new campaign"
          />
          <QuickActionButton
            label="View Funnel"
            description="Analyze conversion funnel"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * StatCard Component
 *
 * Displays a single metric card with value and change indicator.
 * Supports both increase and decrease change types with appropriate colors.
 */
interface StatCardProps {
  stat: {
    key: string;
    label: string;
    value: string;
    change: string;
    changeType: 'increase' | 'decrease';
  };
}

function StatCard({ stat }: StatCardProps) {
  // Determine change color based on type
  const changeColor =
    stat.changeType === 'increase'
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';

  return (
    <div
      className="
        bg-white dark:bg-gray-800
        border border-gray-200 dark:border-gray-700
        rounded-lg p-6
        transition-shadow duration-150
        hover:shadow-md
      "
      data-testid={`stat-card-${stat.key}`}
    >
      {/* Label */}
      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
        {stat.label}
      </div>

      {/* Value */}
      <div className="mt-2 flex items-baseline justify-between">
        <div className="text-2xl font-semibold text-gray-900 dark:text-white">
          {stat.value}
        </div>

        {/* Change Indicator */}
        <div className={`text-sm font-medium ${changeColor}`}>
          {stat.change}
        </div>
      </div>
    </div>
  );
}

/**
 * QuickActionButton Component
 *
 * Displays a quick action button with label and description.
 * This is a placeholder - real actions will be implemented later.
 */
interface QuickActionButtonProps {
  label: string;
  description: string;
}

function QuickActionButton({ label, description }: QuickActionButtonProps) {
  return (
    <button
      type="button"
      className="
        text-left p-4
        bg-gray-50 dark:bg-gray-700
        border border-gray-200 dark:border-gray-600
        rounded-lg
        transition-colors duration-150
        hover:bg-gray-100 dark:hover:bg-gray-600
        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
      "
    >
      <div className="text-sm font-medium text-gray-900 dark:text-white">
        {label}
      </div>
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {description}
      </div>
    </button>
  );
}
