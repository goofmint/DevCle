/**
 * Status Badge Component
 *
 * Displays a colored badge for plugin run status.
 * Supports pending, running, success, and failed states.
 * Dark mode compatible.
 */

/**
 * Status Badge Props
 */
interface StatusBadgeProps {
  /** Run status */
  status: 'pending' | 'running' | 'success' | 'failed';
}

/**
 * Status Badge Component
 *
 * Renders a colored badge based on the status value.
 * Colors are optimized for both light and dark modes.
 *
 * @param status - Run status to display
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  const colors = {
    pending: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    running: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  };

  return (
    <span
      className={`px-2 py-1 rounded text-xs font-semibold ${colors[status]}`}
      data-testid={`status-badge-${status}`}
    >
      {status}
    </span>
  );
}
