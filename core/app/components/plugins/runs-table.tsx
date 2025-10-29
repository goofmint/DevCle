/**
 * Runs Table Component
 *
 * Displays a table of plugin runs.
 * Shows job name, status, timestamps, duration, events processed, and actions.
 */

import { StatusBadge } from './status-badge.js';
import { formatDuration } from '~/utils/format-duration.js';

/**
 * Plugin Run interface
 */
interface PluginRun {
  runId: string;
  jobName: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  startedAt: string;
  completedAt: string | null;
  eventsProcessed: number;
  errorMessage: string | null;
}

/**
 * Runs Table Props
 */
interface RunsTableProps {
  /** List of runs to display */
  runs: PluginRun[];
  /** Handler for viewing run details */
  onViewDetails: (run: PluginRun) => void;
}

/**
 * Runs Table Component
 *
 * Renders a responsive table of plugin runs.
 * Use the "View Details" action to open the run detail modal.
 *
 * @param runs - List of runs to display
 * @param onViewDetails - Handler for viewing run details
 */
export function RunsTable({ runs, onViewDetails }: RunsTableProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Job
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Started
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Duration
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Events
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {runs.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                No runs found
              </td>
            </tr>
          ) : (
            runs.map((run) => (
              <tr key={run.runId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                  {run.jobName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={run.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {new Date(run.startedAt).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {run.completedAt
                    ? formatDuration(
                        new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
                      )
                    : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {run.eventsProcessed}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    type="button"
                    onClick={() => onViewDetails(run)}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                    data-testid={`view-details-${run.runId}`}
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
