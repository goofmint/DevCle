/**
 * Plugin Detail API - Get Plugin Details and Toggle Plugin Status
 *
 * Provides detailed information about a specific plugin, including:
 * - Plugin configuration and status (with sensitive config redacted)
 * - Registered hooks
 * - Registered scheduled jobs with last run timestamps
 *
 * Endpoints:
 * - GET /api/plugins/:id - Get plugin details
 * - PUT /api/plugins/:id - Enable plugin
 * - DELETE /api/plugins/:id - Disable plugin
 *
 * Security:
 * - Authentication required (requireAuth)
 * - Tenant isolation via service layer
 * - UUID validation for plugin IDs
 * - Config redaction for sensitive fields
 */

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { getPluginByKey } from '../../services/plugin.service.js';
import { redactConfig, updatePluginEnabled } from '~/services/plugins.service.js';
import { getLastRunsPerJobName } from '~/services/pluginLogs.service.js';
import { listHooks } from '../../plugin-system/hooks.js';
import type { PluginConfigValues } from '../../plugin-system/types.js';
import type {
  PluginDetailResponse,
  PluginInfo,
  PluginHookInfo,
  PluginJobInfo,
  ApiErrorResponse,
} from '~/types/plugin-api.js';

/**
 * GET /api/plugins/:id - Get plugin details
 *
 * Returns detailed information about a specific plugin, including:
 * - Plugin metadata and configuration
 * - Registered hooks (from hook registry)
 * - Registered jobs (from plugin_runs table)
 *
 * Response:
 * 200 OK
 * {
 *   plugin: {
 *     pluginId: "uuid",
 *     key: "slack",
 *     name: "Slack Integration",
 *     ...
 *   },
 *   hooks: [
 *     { hookName: "after:activity:create", priority: 0 }
 *   ],
 *   jobs: [
 *     { jobName: "sync-data", cron: "0 * * * *", lastRun: "2025-01-01T00:00:00.000Z" }
 *   ]
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid plugin ID format
 * - 401 Unauthorized: Not authenticated
 * - 404 Not Found: Plugin not found
 * - 500 Internal Server Error: Database error
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Get plugin key from params
    const key = params['id'];
    if (!key) {
      const errorResponse: ApiErrorResponse = {
        status: 400,
        message: 'Plugin key is required',
        code: 'MISSING_PLUGIN_KEY',
      };
      return json(errorResponse, { status: 400 });
    }

    // 3. Query plugin from database via service layer (by key)
    let pluginData;
    try {
      pluginData = await getPluginByKey(tenantId, key);
    } catch (error) {
      // Handle plugin not found
      if (error instanceof Error && error.message.includes('Plugin not found')) {
        const errorResponse: ApiErrorResponse = {
          status: 404,
          message: 'Plugin not found',
          code: 'PLUGIN_NOT_FOUND',
        };
        return json(errorResponse, { status: 404 });
      }
      throw error; // Re-throw other errors
    }

    // 4. Check if plugin exists (should not happen due to throw above, but keeping for safety)
    if (!pluginData) {
      const errorResponse: ApiErrorResponse = {
        status: 404,
        message: 'Plugin not found',
        code: 'PLUGIN_NOT_FOUND',
      };
      return json(errorResponse, { status: 404 });
    }

    // Extract pluginId for use in queries
    const pluginId = pluginData.pluginId;

    // 5. Transform plugin data to API format (redact sensitive config)
    const plugin: PluginInfo = {
      pluginId: pluginData.pluginId,
      key: pluginData.key,
      name: pluginData.name,
      version: '1.0.0',
      enabled: pluginData.enabled,
      config: redactConfig(pluginData.config),
      installedAt: pluginData.createdAt,
      updatedAt: pluginData.updatedAt,
    };

    // 6. Get registered hooks for this plugin (from hook registry)
    const allHooks = listHooks();
    const hooks: PluginHookInfo[] = [];

    for (const [hookName, handlers] of allHooks.entries()) {
      // Find handlers registered by this plugin
      const pluginHandlers = handlers.filter((h: { pluginId: string }) => h.pluginId === pluginId);

      if (pluginHandlers.length > 0) {
        hooks.push({
          hookName,
          priority: 0, // Priority is not implemented yet
        });
      }
    }

    // 7. Get registered jobs with last run timestamps (via service)
    // Uses SQL aggregation to compute max(started_at) grouped by job name
    const lastRunsMap = await getLastRunsPerJobName(tenantId, pluginId);

    const jobs: PluginJobInfo[] = Array.from(lastRunsMap.entries()).map(([jobName, lastRun]) => {
      const job: PluginJobInfo = {
        jobName,
        lastRun: lastRun.toISOString(),
      };
      // cron and nextRun are optional, so we don't include them if undefined
      return job;
    });

    // 8. Return plugin details
    const response: PluginDetailResponse = {
      plugin,
      hooks,
      jobs,
    };

    return json(response, { status: 200 });
  } catch (error) {
    // Log error for debugging
    console.error('Error getting plugin details:', error);

    // Return generic error response
    const errorResponse: ApiErrorResponse = {
      status: 500,
      message: 'Failed to get plugin details',
    };
    return json(errorResponse, { status: 500 });
  }
}

/**
 * PUT /api/plugins/:id - Enable plugin
 * DELETE /api/plugins/:id - Disable plugin
 *
 * Toggles the enabled status of a plugin.
 *
 * Response:
 * 200 OK
 * {
 *   success: true,
 *   plugin: { ... updated plugin data ... }
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid plugin ID format
 * - 401 Unauthorized: Not authenticated
 * - 404 Not Found: Plugin not found
 * - 500 Internal Server Error: Database error
 */
export async function action({ request, params }: ActionFunctionArgs) {
  try {
    // 1. Authentication check
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Get plugin key from params and resolve to pluginId
    const key = params['id'];
    if (!key) {
      const errorResponse: ApiErrorResponse = {
        status: 400,
        message: 'Plugin key is required',
        code: 'MISSING_PLUGIN_KEY',
      };
      return json(errorResponse, { status: 400 });
    }

    // Get plugin to resolve pluginId
    let existingPlugin;
    try {
      existingPlugin = await getPluginByKey(tenantId, key);
    } catch (error) {
      // Handle plugin not found
      if (error instanceof Error && error.message.includes('Plugin not found')) {
        const errorResponse: ApiErrorResponse = {
          status: 404,
          message: 'Plugin not found',
          code: 'PLUGIN_NOT_FOUND',
        };
        return json(errorResponse, { status: 404 });
      }
      throw error; // Re-throw other errors
    }

    if (!existingPlugin) {
      const errorResponse: ApiErrorResponse = {
        status: 404,
        message: 'Plugin not found',
        code: 'PLUGIN_NOT_FOUND',
      };
      return json(errorResponse, { status: 404 });
    }

    // 3. Determine new enabled status based on HTTP method
    const method = request.method;
    const newEnabled = method === 'PUT'; // PUT = enable, DELETE = disable

    // 4. Update plugin in database via service layer
    // When disabling (DELETE), clear config to delete all settings
    const updatedPlugin = await updatePluginEnabled(
      tenantId,
      existingPlugin.pluginId,
      newEnabled,
      newEnabled ? undefined : null // Clear config when disabling
    );

    // 5. Check if plugin exists
    if (!updatedPlugin) {
      const errorResponse: ApiErrorResponse = {
        status: 404,
        message: 'Plugin not found',
        code: 'PLUGIN_NOT_FOUND',
      };
      return json(errorResponse, { status: 404 });
    }

    // 6. Transform plugin data to API format (redact sensitive config)
    const plugin: PluginInfo = {
      pluginId: updatedPlugin.pluginId,
      key: updatedPlugin.key,
      name: updatedPlugin.name,
      version: '1.0.0',
      enabled: updatedPlugin.enabled,
      config: redactConfig(updatedPlugin.config as PluginConfigValues | null),
      installedAt: updatedPlugin.createdAt.toISOString(),
      updatedAt: updatedPlugin.updatedAt.toISOString(),
    };

    // 7. Return success response
    return json({ success: true, plugin }, { status: 200 });
  } catch (error) {
    // Log error for debugging
    console.error('Error toggling plugin:', error);

    // Return generic error response
    const errorResponse: ApiErrorResponse = {
      status: 500,
      message: 'Failed to update plugin',
    };
    return json(errorResponse, { status: 500 });
  }
}
