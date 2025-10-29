/**
 * Run Detail Modal Component
 *
 * Displays detailed information about a plugin run in a modal dialog.
 * Shows run ID, job name, status, timestamps, events processed, and errors.
 */

import { Icon } from '@iconify/react';
import { StatusBadge } from './status-badge.js';
import { DetailRow } from './detail-row.js';

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
 * Run Detail Modal Props
 */
interface RunDetailModalProps {
  /** Plugin run to display */
  run: PluginRun;
  /** Close handler */
  onClose: () => void;
}

/**
 * Run Detail Modal Component
 *
 * Renders a modal dialog with detailed information about a plugin run.
 * Clicking outside the modal or on the close button will close it.
 *
 * @param run - Plugin run to display
 * @param onClose - Close handler
 */
export function RunDetailModal({ run, onClose }: RunDetailModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
      data-testid="run-detail-modal"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Run Details</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            data-testid="close-modal-button"
          >
            <Icon icon="mdi:close" className="w-6 h-6" />
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <DetailRow label="Run ID" value={run.runId} mono />
          <DetailRow label="Job Name" value={run.jobName} />
          <DetailRow label="Status" value={<StatusBadge status={run.status} />} />
          <DetailRow label="Started At" value={new Date(run.startedAt).toLocaleString()} />
          <DetailRow
            label="Completed At"
            value={run.completedAt ? new Date(run.completedAt).toLocaleString() : 'Not completed'}
          />
          <DetailRow label="Events Processed" value={String(run.eventsProcessed)} />
          {run.errorMessage && <DetailRow label="Error Message" value={run.errorMessage} error />}
        </div>
      </div>
    </div>
  );
}
