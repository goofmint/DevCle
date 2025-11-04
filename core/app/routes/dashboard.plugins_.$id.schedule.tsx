/**
 * Plugin Schedule Management Page
 *
 * Displays plugin job schedules and allows manual execution.
 * Shows job definitions from plugin.json with last/next run times.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from '@remix-run/react';
import { Icon } from '@iconify/react';
import type { PluginJob } from '../../plugin-system/types.js';

interface JobSchedule {
  name: string;
  route: string;
  cron: string;
  timeoutSec: number;
  description?: string;
  lastRun: {
    runId: string;
    status: 'success' | 'failed';
    startedAt: string;
    completedAt: string | null;
    eventsProcessed: number;
    errorMessage: string | null;
  } | null;
  nextRun: string; // ISO timestamp
}

interface ScheduleData {
  plugin: {
    pluginId: string;
    name: string;
  };
  jobs: JobSchedule[];
}

export default function PluginSchedulePage() {
  const { id } = useParams();
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    // For now, we'll fetch the plugin config to get job definitions
    // In a real implementation, this would be a dedicated /schedule endpoint
    fetch(`/api/plugins/${id}/config`)
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to load plugin');
        }
        return res.json();
      })
      .then((config) => {
        // Mock schedule data (in real implementation, fetch from API)
        const scheduleData: ScheduleData = {
          plugin: {
            pluginId: id,
            name: config.basicInfo.name,
          },
          jobs: (config.jobs || []).map((job: PluginJob) => ({
            ...job,
            lastRun: null,
            nextRun: calculateNextRun(job.cron),
          })),
        };
        setData(scheduleData);
      })
      .catch((err) => {
        console.error('Failed to load schedule:', err);
        setError(err.message || 'Failed to load schedule');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleManualRun = async (jobName: string) => {
    if (!id) return;

    setExecuting(jobName);
    try {
      const res = await fetch(`/api/plugins/${id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobName }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to start job');
      }

      // Show success message (in real implementation, poll for status)
      alert('Job started successfully');
    } catch (err) {
      console.error('Failed to run job:', err);
      alert(err instanceof Error ? err.message : 'Failed to run job');
    } finally {
      setExecuting(null);
    }
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
        <p className="text-gray-600 dark:text-gray-400">Plugin not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
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
          Job Schedule: {data.plugin.name}
        </h1>
      </div>

      {/* Job List */}
      <div className="space-y-4">
        {data.jobs.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
            <Icon icon="mdi:calendar-clock" className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-400">No scheduled jobs configured</p>
          </div>
        ) : (
          data.jobs.map((job: JobSchedule) => (
            <div
              key={job.name}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {job.name}
                  </h3>
                  {job.description && (
                    <p className="text-gray-600 dark:text-gray-400 mb-4">{job.description}</p>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Cron:</span>{' '}
                      <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-900 dark:text-gray-100">
                        {job.cron}
                      </code>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Timeout:</span>{' '}
                      <span className="text-gray-900 dark:text-gray-100">{job.timeoutSec}s</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Next Run:</span>{' '}
                      <span className="text-gray-900 dark:text-gray-100">
                        {new Date(job.nextRun).toLocaleString()}
                      </span>
                    </div>
                    {job.lastRun && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Last Run:</span>{' '}
                        <span
                          className={
                            job.lastRun.status === 'success'
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }
                        >
                          {job.lastRun.status} ({job.lastRun.eventsProcessed} events)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleManualRun(job.name)}
                  disabled={executing === job.name}
                  className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {executing === job.name ? (
                    <>
                      <Icon icon="mdi:loading" className="w-5 h-5 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Icon icon="mdi:play" className="w-5 h-5" />
                      Run Now
                    </>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Calculate next run time from cron expression
 * This is a simplified implementation - in production, use a library like cron-parser
 */
function calculateNextRun(_cron: string): string {
  // Mock: return 1 hour from now
  const next = new Date();
  next.setHours(next.getHours() + 1);
  return next.toISOString();
}
