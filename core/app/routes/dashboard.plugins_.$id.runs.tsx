/**
 * Plugin Runs History Page
 *
 * Displays execution history for plugin jobs with filtering and pagination.
 * Shows run status, timestamps, events processed, and error messages.
 *
 * Features:
 * - Status filter (pending/running/success/failed)
 * - Job name filter
 * - Pagination
 * - Run details modal
 * - Summary statistics
 * - Dark mode support
 */

import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from '@remix-run/react';
import { Icon } from '@iconify/react';
import { SummaryCard } from '~/components/plugins/summary-card.js';
import { FilterButton } from '~/components/plugins/filter-button.js';
import { RunDetailModal } from '~/components/plugins/run-detail-modal.js';
import { RunsTable } from '~/components/plugins/runs-table.js';
import { RunsPagination } from '~/components/plugins/runs-pagination.js';

/**
 * Plugin run record from database
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
 * Aggregated statistics for all runs
 */
interface RunSummary {
  total: number;
  success: number;
  failed: number;
  running: number;
  pending: number;
  avgEventsProcessed: number;
  avgDuration: number;
}

/**
 * API response structure
 */
interface RunsData {
  runs: PluginRun[];
  total: number;
  summary: RunSummary;
}

/**
 * Main component
 */
export default function PluginRunsPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<RunsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<PluginRun | null>(null);

  const status = searchParams.get('status') || undefined;
  const jobName = searchParams.get('jobName') || undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 20;

  // Fetch runs data from API
  useEffect(() => {
    if (!id) return;

    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (jobName) params.set('jobName', jobName);
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
  }, [id, status, jobName, page]);

  /**
   * Update status filter and reset to page 1
   */
  const handleStatusFilterChange = (newStatus: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (newStatus) {
      newParams.set('status', newStatus);
    } else {
      newParams.delete('status');
    }
    newParams.set('page', '1'); // Reset to page 1
    setSearchParams(newParams);
  };

  /**
   * Update job name filter and reset to page 1
   */
  const handleJobNameFilterChange = (newJobName: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (newJobName.trim()) {
      newParams.set('jobName', newJobName.trim());
    } else {
      newParams.delete('jobName');
    }
    newParams.set('page', '1'); // Reset to page 1
    setSearchParams(newParams);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon icon="mdi:loading" className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Error state
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

  // No data state
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
      <div className="mb-4 space-y-4">
        {/* Status Filters */}
        <div className="flex flex-wrap gap-2">
          <FilterButton
            label="All"
            active={!status}
            onClick={() => handleStatusFilterChange(null)}
          />
          <FilterButton
            label="Success"
            active={status === 'success'}
            onClick={() => handleStatusFilterChange('success')}
          />
          <FilterButton
            label="Failed"
            active={status === 'failed'}
            onClick={() => handleStatusFilterChange('failed')}
          />
          <FilterButton
            label="Running"
            active={status === 'running'}
            onClick={() => handleStatusFilterChange('running')}
          />
          <FilterButton
            label="Pending"
            active={status === 'pending'}
            onClick={() => handleStatusFilterChange('pending')}
          />
        </div>

        {/* Job Name Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              defaultValue={jobName || ''}
              placeholder="Filter by job name..."
              className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleJobNameFilterChange(e.currentTarget.value);
                }
              }}
              data-testid="job-name-filter-input"
            />
            <Icon
              icon="mdi:magnify"
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500"
            />
          </div>
          <button
            onClick={(e) => {
              const input = e.currentTarget.previousElementSibling?.querySelector('input');
              if (input) {
                handleJobNameFilterChange(input.value);
              }
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            data-testid="job-name-filter-button"
          >
            <Icon icon="mdi:magnify" className="w-5 h-5" />
          </button>
          {jobName && (
            <button
              onClick={() => handleJobNameFilterChange('')}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              data-testid="job-name-filter-clear"
            >
              <Icon icon="mdi:close" className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Runs Table */}
      <RunsTable runs={runs} onViewDetails={setSelectedRun} />

      {/* Pagination */}
      <RunsPagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPrevious={() => {
          const newParams = new URLSearchParams(searchParams);
          newParams.set('page', String(page - 1));
          setSearchParams(newParams);
        }}
        onNext={() => {
          const newParams = new URLSearchParams(searchParams);
          newParams.set('page', String(page + 1));
          setSearchParams(newParams);
        }}
      />

      {/* Details Modal */}
      {selectedRun && <RunDetailModal run={selectedRun} onClose={() => setSelectedRun(null)} />}
    </div>
  );
}
