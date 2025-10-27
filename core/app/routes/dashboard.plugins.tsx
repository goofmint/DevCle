/**
 * Plugin Management Page (SPA)
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

import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import type { PluginInfo } from '../types/plugin-api.js';

/**
 * Toast notification type
 */
interface Toast {
  type: 'success' | 'error';
  message: string;
}

/**
 * Plugin Management Page Component
 */
export default function PluginsPage() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  /**
   * Fetch plugins on component mount
   */
  useEffect(() => {
    fetchPlugins();
  }, []);

  /**
   * Fetch plugins list from API
   */
  async function fetchPlugins() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/plugins');
      if (!response.ok) {
        throw new Error('Failed to fetch plugins');
      }

      const data = await response.json() as { plugins: PluginInfo[] };
      setPlugins(data.plugins);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      showToast('error', 'Failed to load plugins');
    } finally {
      setLoading(false);
    }
  }


  /**
   * Toggle plugin enabled status
   */
  async function togglePlugin(pluginId: string, currentEnabled: boolean) {
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


  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">Error: {error}</p>
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
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700"
          >
            {/* Plugin header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {plugin.name}
                </h3>
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
                <Icon icon="mdi:calendar" className="mr-2" />
                <span>Installed: {new Date(plugin.installedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <Icon icon="mdi:update" className="mr-2" />
                <span>Updated: {new Date(plugin.updatedAt).toLocaleDateString()}</span>
              </div>
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
          <Icon
            icon="mdi:puzzle-outline"
            className="mx-auto text-gray-400 dark:text-gray-600 mb-4"
            width="64"
          />
          <p className="text-gray-600 dark:text-gray-400">No plugins installed</p>
        </div>
      )}
    </div>
  );
}
