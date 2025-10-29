/**
 * Plugin Runs History Page
 *
 * Displays execution history for plugin jobs with filtering and pagination.
 * Shows run status, timestamps, events processed, and error messages.
 */

import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from '@remix-run/react';
import { Icon } from '@iconify/react';

interface PluginRun {
  runId: string;
  jobName: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  startedAt: string;
  completedAt: string | null;
  eventsProcessed: number;
  errorMessage: string | null;
}

interface RunSummary {
  total: number;
  success: number;
  failed: number;
  running: number;
  pending: number;
  avgEventsProcessed: number;
  avgDuration: number;
}

interface RunsData {
  runs: PluginRun[];
  total: number;
  summary: RunSummary;
}

export default function PluginRunsPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<RunsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<PluginRun | null>(null);

  const status = searchParams.get('status') || undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 20;

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('offset', String((page - 1) * limit));
    params.set('limit', String(limit));

    fetch(`/api/plugins/${id}/runs?${params}`)
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to load runs');
        }
        return res.json();
      })
      .then(setData)
      .catch((err) => {
        console.error('Failed to load runs:', err);
        setError(err.message || 'Failed to load runs');
      })
      .finally(() => setLoading(false));
  }, [id, status, page]);

  const handleFilterChange = (newStatus: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (newStatus) {
      newParams.set('status', newStatus);
    } else {
      newParams.delete('status');
    }
    newParams.set('page', '1'); // Reset to page 1
    setSearchParams(newParams);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon icon="mdi:loading" className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:alert-circle" className="w-6 h-6 text-red-600 dark:text-red-400" />
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">Error</h3>
          </div>
          <p className="mt-2 text-red-700 dark:text-red-300">{error}</p>
          <Link
            to="/dashboard/plugins"
            className="mt-4 inline-flex items-center gap-2 text-red-600 dark:text-red-400 hover:underline"
          >
            <Icon icon="mdi:arrow-left" className="w-4 h-4" />
            Back to Plugins
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4">
        <p className="text-gray-600 dark:text-gray-400">No data available</p>
      </div>
    );
  }

  const { runs, total, summary } = data;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/dashboard/plugins"
          className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline mb-4"
        >
          <Icon icon="mdi:arrow-left" className="w-4 h-4" />
          Back to Plugins
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Execution History
        </h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <SummaryCard
          label="Total"
          value={summary.total}
          icon="mdi:database"
          color="gray"
        />
        <SummaryCard
          label="Success"
          value={summary.success}
          icon="mdi:check-circle"
          color="green"
        />
        <SummaryCard
          label="Failed"
          value={summary.failed}
          icon="mdi:alert-circle"
          color="red"
        />
        <SummaryCard
          label="Running"
          value={summary.running}
          icon="mdi:loading"
          color="blue"
        />
        <SummaryCard
          label="Avg Events"
          value={summary.avgEventsProcessed}
          icon="mdi:chart-line"
          color="purple"
        />
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-2">
        <FilterButton
          label="All"
          active={!status}
          onClick={() => handleFilterChange(null)}
        />
        <FilterButton
          label="Success"
          active={status === 'success'}
          onClick={() => handleFilterChange('success')}
        />
        <FilterButton
          label="Failed"
          active={status === 'failed'}
          onClick={() => handleFilterChange('failed')}
        />
        <FilterButton
          label="Running"
          active={status === 'running'}
          onClick={() => handleFilterChange('running')}
        />
        <FilterButton
          label="Pending"
          active={status === 'pending'}
          onClick={() => handleFilterChange('pending')}
        />
      </div>

      {/* Runs Table */}
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
                      onClick={() => setSelectedRun(run)}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Page {page} of {totalPages} ({total} total runs)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const newParams = new URLSearchParams(searchParams);
                newParams.set('page', String(page - 1));
                setSearchParams(newParams);
              }}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => {
                const newParams = new URLSearchParams(searchParams);
                newParams.set('page', String(page + 1));
                setSearchParams(newParams);
              }}
              disabled={page === totalPages}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedRun && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedRun(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Run Details
              </h3>
              <button
                onClick={() => setSelectedRun(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <Icon icon="mdi:close" className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <DetailRow label="Run ID" value={selectedRun.runId} mono />
              <DetailRow label="Job Name" value={selectedRun.jobName} />
              <DetailRow label="Status" value={<StatusBadge status={selectedRun.status} />} />
              <DetailRow label="Started At" value={new Date(selectedRun.startedAt).toLocaleString()} />
              <DetailRow
                label="Completed At"
                value={selectedRun.completedAt ? new Date(selectedRun.completedAt).toLocaleString() : 'Not completed'}
              />
              <DetailRow label="Events Processed" value={String(selectedRun.eventsProcessed)} />
              {selectedRun.errorMessage && (
                <DetailRow label="Error Message" value={selectedRun.errorMessage} error />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
}) {
  const colorClasses = {
    gray: 'text-gray-600 dark:text-gray-400',
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon icon={icon} className={`w-5 h-5 ${colorClasses[color as keyof typeof colorClasses]}`} />
        <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
      }`}
    >
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    pending: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    running: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${colors[status as keyof typeof colors]}`}>
      {status}
    </span>
  );
}

function DetailRow({ label, value, mono = false, error = false }: { label: string; value: React.ReactNode; mono?: boolean; error?: boolean }) {
  return (
    <div className="flex gap-4">
      <span className="font-semibold text-gray-700 dark:text-gray-300 w-32 flex-shrink-0">
        {label}:
      </span>
      <span className={`flex-1 ${mono ? 'font-mono text-xs' : ''} ${error ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
        {value}
      </span>
    </div>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
