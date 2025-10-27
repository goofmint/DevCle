/**
 * Plugin Detail API - Get Plugin Details
 *
 * Provides detailed information about a specific plugin, including:
 * - Plugin configuration and status (with sensitive config redacted)
 * - Registered hooks
 * - Registered scheduled jobs with last run timestamps
 *
 * Endpoint:
 * - GET /api/plugins/:id - Get plugin details
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
} from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { isValidUUID } from '~/utils/validation.js';
import { redactConfig } from '~/services/plugins.service.js';
import { getLastRunsPerTrigger } from '~/services/pluginLogs.service.js';
import { withTenantContext } from '../../db/connection.js';
import * as schema from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { listHooks } from '../../plugin-system/hooks.js';
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

    // 2. Validate plugin ID format
    const pluginId = params['id'];
    if (!isValidUUID(pluginId)) {
      const errorResponse: ApiErrorResponse = {
        status: 400,
        message: 'Invalid plugin ID format (must be UUID)',
        code: 'INVALID_UUID',
      };
      return json(errorResponse, { status: 400 });
    }

    // 3. Query plugin from database
    const pluginData = await withTenantContext(tenantId, async (tx) => {
      const result = await tx
        .select()
        .from(schema.plugins)
        .where(eq(schema.plugins.pluginId, pluginId))
        .limit(1);

      return result[0] || null;
    });

    // 4. Check if plugin exists
    if (!pluginData) {
      const errorResponse: ApiErrorResponse = {
        status: 404,
        message: 'Plugin not found',
        code: 'PLUGIN_NOT_FOUND',
      };
      return json(errorResponse, { status: 404 });
    }

    // 5. Transform plugin data to API format (redact sensitive config)
    const plugin: PluginInfo = {
      pluginId: pluginData.pluginId,
      key: pluginData.key,
      name: pluginData.name,
      version: '1.0.0',
      enabled: pluginData.enabled,
      config: redactConfig(pluginData.config),
      installedAt: pluginData.createdAt.toISOString(),
      updatedAt: pluginData.updatedAt.toISOString(),
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
    // Uses SQL aggregation to compute max(started_at) grouped by trigger
    const lastRunsMap = await getLastRunsPerTrigger(tenantId, pluginId);

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
