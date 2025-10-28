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
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            )}

            {/* Plugin header */}
            <div className="flex items-start justify-between mb-4 pr-10">
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
                <svg className="mr-2 w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Installed: {new Date(plugin.installedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <svg className="mr-2 w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21.5 2V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M18.5 5H21.5H24.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
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
          <svg className="mx-auto text-gray-400 dark:text-gray-600 mb-4" width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-gray-600 dark:text-gray-400">No plugins installed</p>
        </div>
      )}
    </div>
  );
}
