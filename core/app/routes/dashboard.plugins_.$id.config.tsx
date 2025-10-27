/**
 * Plugin Configuration Page
 * Displays plugin configuration information including
 * basic info, capabilities, settings schema, and routes
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from '@remix-run/react';
import { Icon } from '@iconify/react';
import type { PluginConfigInfo } from '~/services/plugin/plugin-config.types.js';

export default function PluginConfigPage() {
  const { id } = useParams();
  const [config, setConfig] = useState<PluginConfigInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/plugins/${id}/config`)
      .then(async (res) => {
        if (!res.ok) {
          // Try to parse error from API response
          try {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Failed to load plugin');
          } catch {
            throw new Error('Failed to load plugin');
          }
        }
        return res.json();
      })
      .then((data) => setConfig(data))
      .catch((err) => {
        // Log full error for debugging
        console.error('Plugin config load error:', err);

        // Sanitize error message for user display
        const userMessage = err.message || 'An unexpected error occurred';
        setError(userMessage);
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

  if (!config) {
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
          Plugin Configuration: {config.basicInfo.name}
        </h1>
      </div>

      {/* Basic Info Section */}
      <section className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Icon icon="mdi:information" className="w-6 h-6" />
          Basic Information
        </h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">ID</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{config.basicInfo.id}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{config.basicInfo.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Version</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{config.basicInfo.version}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Vendor</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{config.basicInfo.vendor}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">License</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{config.basicInfo.license}</dd>
          </div>
          {config.basicInfo.homepage && (
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Homepage</dt>
              <dd className="mt-1 text-sm">
                <a
                  href={config.basicInfo.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {config.basicInfo.homepage}
                </a>
              </dd>
            </div>
          )}
          <div className="md:col-span-2">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{config.basicInfo.description}</dd>
          </div>
        </dl>
      </section>

      {/* Capabilities Section */}
      <section className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Icon icon="mdi:shield-check" className="w-6 h-6" />
          Capabilities
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Scopes</h3>
            <div className="flex flex-wrap gap-2">
              {config.capabilities.scopes.map((scope: string) => (
                <span
                  key={scope}
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    scope.startsWith('write:')
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                  }`}
                >
                  {scope}
                </span>
              ))}
              {config.capabilities.scopes.length === 0 && (
                <span className="text-sm text-gray-500 dark:text-gray-400">No scopes defined</span>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Network</h3>
            <ul className="list-disc list-inside space-y-1">
              {config.capabilities.network.map((url: string) => (
                <li key={url} className="text-sm text-gray-900 dark:text-gray-100">
                  {url}
                </li>
              ))}
              {config.capabilities.network.length === 0 && (
                <li className="text-sm text-gray-500 dark:text-gray-400">No network access defined</li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Secrets</h3>
            <ul className="list-disc list-inside space-y-1">
              {config.capabilities.secrets.map((secret: string) => (
                <li key={secret} className="text-sm text-gray-900 dark:text-gray-100">
                  {secret}
                </li>
              ))}
              {config.capabilities.secrets.length === 0 && (
                <li className="text-sm text-gray-500 dark:text-gray-400">No secrets defined</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* Settings Schema Section */}
      {config.settingsSchema.length > 0 && (
        <section className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Icon icon="mdi:cog" className="w-6 h-6" />
            Settings Schema
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Key
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Label
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Required
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {config.settingsSchema.map((setting: typeof config.settingsSchema[number]) => (
                  <tr key={setting.key}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {setting.key}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{setting.label}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{setting.type}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {setting.required ? (
                        <Icon icon="mdi:check" className="w-5 h-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <Icon icon="mdi:minus" className="w-5 h-5 text-gray-400" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Routes Section */}
      {config.routes.length > 0 && (
        <section className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Icon icon="mdi:routes" className="w-6 h-6" />
            Routes
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Path
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Auth
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Timeout (s)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {config.routes.map((route: typeof config.routes[number], index: number) => (
                  <tr key={`${route.method}-${route.path}-${index}`}>
                    <td className="px-4 py-3 text-sm font-medium">
                      <span
                        className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                          route.method === 'GET'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                            : route.method === 'POST'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                              : route.method === 'PUT'
                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                        }`}
                      >
                        {route.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{route.path}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{route.auth}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{route.timeoutSec}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
