/**
 * Plugin Card Component
 *
 * Displays a single plugin with its information and action buttons.
 * Supports dark/light mode.
 */

import { Icon } from '@iconify/react';
import type { PluginInfo } from '../../types/plugin-api.js';

/**
 * Plugin Card Props
 */
interface PluginCardProps {
  /** Plugin information */
  plugin: PluginInfo;
  /** Callback for toggle enable/disable */
  onToggle: (pluginId: string, currentEnabled: boolean) => void;
  /** Callback for viewing logs */
  onViewLogs: (pluginId: string) => void;
}

/**
 * Plugin Card Component
 *
 * Renders a card with plugin information and action buttons.
 */
export function PluginCard({ plugin, onToggle, onViewLogs }: PluginCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
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

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onToggle(plugin.pluginId, plugin.enabled)}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            plugin.enabled
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {plugin.enabled ? 'Disable' : 'Enable'}
        </button>
        <button
          type="button"
          onClick={() => onViewLogs(plugin.pluginId)}
          className="px-4 py-2 rounded-lg font-medium bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          View Logs
        </button>
      </div>
    </div>
  );
}
