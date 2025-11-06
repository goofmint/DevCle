/**
 * Plugin Detail Page
 *
 * Display detailed information about a plugin and provide navigation to:
 * - Job Schedule Management
 * - Execution History (Runs)
 * - Plugin Configuration (Edit)
 *
 * Accessible at: /dashboard/plugins/:id
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from '@remix-run/react';
import { Icon } from '@iconify/react';

interface PluginInfo {
  pluginId: string;
  key: string;
  name: string;
  version: string;
  enabled: boolean;
  installedAt: string;
  updatedAt: string;
}

interface PluginHook {
  hookName: string;
  priority: number;
}

interface PluginJob {
  jobName: string;
  lastRun?: string;
  cron?: string;
  nextRun?: string;
}

interface PluginDetailData {
  plugin: PluginInfo;
  hooks: PluginHook[];
  jobs: PluginJob[];
}

export default function PluginDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<PluginDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/plugins/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to load plugin');
        }
        return res.json();
      })
      .then(setData)
      .catch((err) => {
        console.error('Failed to load plugin:', err);
        setError(err.message || 'Failed to load plugin');
      })
      .finally(() => setLoading(false));
  }, [id]);

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

  const { plugin, hooks, jobs } = data;

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {plugin.name}
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">{plugin.key}</p>
          </div>
          <div
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              plugin.enabled
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
            }`}
          >
            {plugin.enabled ? 'Enabled' : 'Disabled'}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link
          to={`/dashboard/plugins/${id}/schedule`}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <Icon icon="mdi:calendar-clock" className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Job Schedule
            </h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            View and manage scheduled jobs
          </p>
        </Link>

        <Link
          to={`/dashboard/plugins/${id}/runs`}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <Icon icon="mdi:history" className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Execution History
            </h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            View past job execution results
          </p>
        </Link>

        <Link
          to={`/dashboard/plugins/${id}/edit`}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <Icon icon="mdi:cog" className="w-6 h-6 text-green-600 dark:text-green-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Configuration
            </h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Edit plugin settings
          </p>
        </Link>
      </div>

      {/* Plugin Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Plugin Information
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Version</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{plugin.version}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Installed</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {new Date(plugin.installedAt).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {new Date(plugin.updatedAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>

        {/* Hooks */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Registered Hooks
          </h2>
          {hooks.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No hooks registered</p>
          ) : (
            <ul className="space-y-2">
              {hooks.map((hook, index) => (
                <li
                  key={index}
                  className="text-sm text-gray-900 dark:text-gray-100 font-mono bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded"
                >
                  {hook.hookName}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Jobs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 lg:col-span-2">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Scheduled Jobs
          </h2>
          {jobs.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No jobs configured</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Job Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Last Run
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Schedule
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {jobs.map((job, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {job.jobName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {job.lastRun ? new Date(job.lastRun).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {job.cron || 'Manual only'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
