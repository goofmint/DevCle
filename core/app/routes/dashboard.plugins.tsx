/**
 * Plugin Management Page
 *
 * Admin page for managing installed plugins.
 * Accessible at: /dashboard/plugins
 *
 * Features:
 * - List all installed plugins
 * - Enable/disable plugins
 * - Toast notifications
 * - Dark/Light mode support
 */

import { useState } from 'react';
import { Link, useLoaderData } from '@remix-run/react';
import { json } from '@remix-run/node';
import type { LoaderFunctionArgs } from '@remix-run/node';
import type { PluginInfo } from '../types/plugin-api.js';
import { requireAuth } from '~/auth.middleware.js';
import { listPlugins, redactConfig } from '~/services/plugins.service.js';
import { getPluginConfig } from '~/services/plugin/plugin-config.service.js';
import { Icon } from '@iconify/react';

/**
 * Toast notification type
 */
interface Toast {
  type: 'success' | 'error';
  message: string;
}

/**
 * Loader - Fetch plugins server-side for SSR
 *
 * Fetches all installed plugins for the current tenant.
 * This ensures Icon components render during SSR, enabling Iconify to work properly.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Query plugins via service (reads from filesystem + DB state)
    const pluginsData = await listPlugins(tenantId);

    // 3. Transform to API response format and check for settings schema
    const plugins: PluginInfo[] = await Promise.all(
      pluginsData.map(async (plugin) => {
        // Check if plugin has settings schema
        let hasSettings = false;
        try {
          const config = await getPluginConfig(plugin.key, tenantId);
          hasSettings = !!(config.settingsSchema && Array.isArray(config.settingsSchema) && config.settingsSchema.length > 0);
        } catch (error) {
          // Plugin has no config file or no settings schema
          hasSettings = false;
        }

        return {
          pluginId: plugin.pluginId,
          key: plugin.key,
          name: plugin.name,
          version: plugin.version,
          enabled: plugin.enabled,
          config: redactConfig(plugin.config),
          installedAt: plugin.createdAt.toISOString(),
          updatedAt: plugin.updatedAt.toISOString(),
          hasSettings,
        };
      })
    );

    // 4. Return plugin list
    return json({ plugins });
  } catch (error) {
    // Handle requireAuth() redirect
    if (error instanceof Response) {
      throw error;
    }

    // Log error for debugging
    console.error('Error loading plugins:', error);

    // Return error state
    return json(
      { plugins: [], error: 'Failed to load plugins' },
      { status: 500 }
    );
  }
}

/**
 * Plugin Management Page Component
 */
export default function PluginsPage() {
  // Get plugins from server-side loader
  const loaderData = useLoaderData<typeof loader>();
  const [plugins, setPlugins] = useState<PluginInfo[]>(loaderData.plugins as PluginInfo[]);
  const [toast, setToast] = useState<Toast | null>(null);


  /**
   * Toggle plugin enabled status
   */
  async function togglePlugin(pluginId: string, currentEnabled: boolean) {
    // Show confirmation dialog when disabling (settings will be deleted)
    if (currentEnabled) {
      const confirmed = window.confirm(
        'Are you sure you want to disable this plugin?\n\n' +
        'Warning: All plugin settings will be deleted and cannot be recovered.\n' +
        'You will need to reconfigure the plugin if you enable it again.'
      );

      if (!confirmed) {
        return; // User canceled
      }
    }

    try {
      const method = currentEnabled ? 'DELETE' : 'PUT';
      const response = await fetch(`/api/plugins/${pluginId}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to update plugin');
      }

      const data = await response.json() as { success: boolean; plugin: PluginInfo };
      if (data.success) {
        // Update plugin in list
        setPlugins((prev) =>
          prev.map((p) => (p.pluginId === pluginId ? data.plugin : p))
        );

        showToast(
          'success',
          `Plugin ${currentEnabled ? 'disabled' : 'enabled'} successfully`
        );
      }
    } catch (err) {
      showToast('error', 'Failed to update plugin');
    }
  }

  /**
   * Show toast notification
   */
  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }

  // Check if loader returned error
  if ('error' in loaderData && loaderData.error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">Error: {String(loaderData.error)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg p-4 shadow-lg ${
            toast.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}
        >
          <p
            className={
              toast.type === 'success'
                ? 'text-green-800 dark:text-green-200'
                : 'text-red-800 dark:text-red-200'
            }
          >
            {toast.message}
          </p>
        </div>
      )}

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Plugin Management
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage installed plugins and view execution logs
        </p>
      </div>

      {/* Plugins grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plugins.map((plugin) => (
          <div
            key={plugin.pluginId}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 relative"
          >
            {/* Settings icon (top right, enabled plugins with settings only) */}
            {plugin.enabled && plugin.hasSettings && (
              <Link
                to={`/dashboard/plugins/${plugin.pluginId}/edit`}
                className="absolute top-4 right-4 p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Configure plugin"
              >
                <Icon icon="heroicons:cog-6-tooth" className="w-5 h-5" />
              </Link>
            )}

            {/* Plugin header */}
            <div className="flex items-start justify-between mb-4 pr-10">
              <div className="flex-1">
                <Link
                  to={`/dashboard/plugins/${plugin.pluginId}`}
                  className="text-lg font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {plugin.name}
                </Link>
                <p className="text-sm text-gray-500 dark:text-gray-400">{plugin.key}</p>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  plugin.enabled
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                }`}
              >
                {plugin.enabled ? 'Enabled' : 'Disabled'}
              </div>
            </div>

            {/* Plugin info */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <Icon icon="heroicons:calendar" className="mr-2 w-4 h-4" />
                <span>Installed: {new Date(plugin.installedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <Icon icon="heroicons:clock" className="mr-2 w-4 h-4" />
                <span>Updated: {new Date(plugin.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Quick links */}
            <div className="flex gap-2 mb-4">
              <Link
                to={`/dashboard/plugins/${plugin.pluginId}/schedule`}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                title="Job Schedule"
              >
                <Icon icon="mdi:calendar-clock" className="w-4 h-4" />
                <span>Schedule</span>
              </Link>
              <Link
                to={`/dashboard/plugins/${plugin.pluginId}/runs`}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                title="Execution History"
              >
                <Icon icon="mdi:history" className="w-4 h-4" />
                <span>Runs</span>
              </Link>
            </div>

            {/* Action button */}
            <button
              type="button"
              onClick={() => togglePlugin(plugin.pluginId, plugin.enabled)}
              className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                plugin.enabled
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {plugin.enabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {plugins.length === 0 && (
        <div className="text-center py-12">
          <Icon icon="heroicons:cube-transparent" className="mx-auto text-gray-400 dark:text-gray-600 mb-4 w-16 h-16" />
          <p className="text-gray-600 dark:text-gray-400">No plugins installed</p>
        </div>
      )}
    </div>
  );
}
