import { Icon } from '@iconify/react';

/**
 * Activity Type data structure
 */
interface ActivityType {
  activityTypeId: string;
  action: string;
  iconName: string;
  colorClass: string;
  stageKey: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Props for ActivityTypeTable component
 */
interface ActivityTypeTableProps {
  /** Array of activity types to display */
  activityTypes: ActivityType[];
  /** Callback when edit button is clicked */
  onEdit: (action: string) => void;
  /** Callback when delete button is clicked */
  onDelete: (action: string) => void;
}

/**
 * Activity Type Table Component
 *
 * Displays all activity types in a table with:
 * - Action name
 * - Icon preview (using @iconify/react)
 * - Color preview (colored badge)
 * - Funnel stage (if mapped)
 * - Edit/Delete buttons
 *
 * Table columns:
 * 1. Action (string)
 * 2. Icon (visual preview with Iconify)
 * 3. Color (badge with applied Tailwind classes)
 * 4. Funnel Stage (stage name or '-')
 * 5. Actions (Edit/Delete buttons)
 */
export function ActivityTypeTable({ activityTypes, onEdit, onDelete }: ActivityTypeTableProps) {
  // Empty state
  if (activityTypes.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <Icon
          icon="heroicons:inbox"
          className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4"
        />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          No activity types found
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Create one to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        {/* Table Header */}
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Action
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Icon
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Color
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Funnel Stage
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Actions
            </th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {activityTypes.map((activityType) => (
            <tr key={activityType.activityTypeId} className="hover:bg-gray-50 dark:hover:bg-gray-800">
              {/* Action Column */}
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                {activityType.action}
              </td>

              {/* Icon Column */}
              <td className="px-6 py-4 whitespace-nowrap">
                <Icon
                  icon={activityType.iconName}
                  className="w-6 h-6 text-gray-700 dark:text-gray-300"
                />
              </td>

              {/* Color Column */}
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`inline-block px-3 py-1 rounded-full border text-sm font-medium ${activityType.colorClass}`}
                >
                  Badge
                </span>
              </td>

              {/* Funnel Stage Column */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {activityType.stageKey || '-'}
              </td>

              {/* Actions Column */}
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <button
                  onClick={() => onEdit(activityType.action)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(activityType.action)}
                  className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
