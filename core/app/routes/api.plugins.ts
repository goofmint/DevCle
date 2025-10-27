/**
 * Plugin Management API - List and Enable/Disable
 *
 * Provides REST API for plugin management operations.
 * Supports listing all plugins and enabling/disabling individual plugins.
 *
 * Endpoints:
 * - GET    /api/plugins      - List all installed plugins for current tenant
 * - PUT    /api/plugins/:id  - Enable a plugin (and optionally update config)
 * - DELETE /api/plugins/:id  - Disable a plugin
 *
 * Security:
 * - Authentication required for all endpoints (requireAuth)
 * - Tenant isolation via RLS (withTenantContext)
 * - UUID validation for plugin IDs
 * - CSRF protection via SameSite cookies (Remix default)
 */

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { isValidUUID } from '~/utils/validation.js';
import { listPlugins, updatePluginEnabled, redactConfig } from '~/services/plugins.service.js';
import type {
  PluginListResponse,
  PluginSummary,
  PluginInfo,
  EnablePluginRequest,
  PluginActionResponse,
  ApiErrorResponse,
} from '~/types/plugin-api.js';

/**
 * GET /api/plugins - List all plugins
 *
 * Returns all installed plugins for the current tenant.
 * Includes plugin configuration and status.
 *
 * Response:
 * 200 OK
 * {
 *   plugins: [
 *     {
 *       pluginId: "uuid",
 *       key: "slack",
 *       name: "Slack Integration",
 *       version: "1.0.0",
 *       enabled: true,
 *       config: {...},
 *       installedAt: "2025-01-01T00:00:00.000Z",
 *       updatedAt: "2025-01-02T00:00:00.000Z"
 *     }
 *   ]
 * }
 *
 * Error Responses:
 * - 401 Unauthorized: Not authenticated
 * - 500 Internal Server Error: Database error
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Query plugins via service (reads from filesystem + DB state)
    const pluginsData = await listPlugins(tenantId);

    // 3. Transform to API response format (omit config for security)
    const plugins: PluginSummary[] = pluginsData.map((plugin) => ({
      pluginId: plugin.pluginId,
      key: plugin.key,
      name: plugin.name,
      version: plugin.version, // Now read from plugin.json
      enabled: plugin.enabled,
      installedAt: plugin.createdAt.toISOString(),
      updatedAt: plugin.updatedAt.toISOString(),
    }));

    // 4. Return plugin list
    const response: PluginListResponse = { plugins };
    return json(response, { status: 200 });
  } catch (error) {
    // Log error for debugging
    console.error('Error listing plugins:', error);

    // Return generic error response
    const errorResponse: ApiErrorResponse = {
      status: 500,
      message: 'Failed to list plugins',
    };
    return json(errorResponse, { status: 500 });
  }
}

/**
 * PUT /api/plugins/:id - Enable plugin
 * DELETE /api/plugins/:id - Disable plugin
 *
 * Updates plugin enabled status and optionally updates configuration.
 *
 * PUT Request Body:
 * {
 *   config?: {...}  // Optional: update plugin configuration
 * }
 *
 * Response:
 * 200 OK
 * {
 *   success: true,
 *   plugin: {...}
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid plugin ID format
 * - 401 Unauthorized: Not authenticated
 * - 404 Not Found: Plugin not found
 * - 422 Unprocessable Entity: Invalid request body
 * - 500 Internal Server Error: Database error
 */
export async function action({ request, params }: ActionFunctionArgs) {
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

    // 3. Determine action based on HTTP method
    const method = request.method;
    const isEnable = method === 'PUT';
    const isDisable = method === 'DELETE';

    if (!isEnable && !isDisable) {
      const errorResponse: ApiErrorResponse = {
        status: 405,
        message: 'Method not allowed (use PUT or DELETE)',
        code: 'METHOD_NOT_ALLOWED',
      };
      return json(errorResponse, { status: 405 });
    }

    // 4. Parse request body for PUT (enable with optional config update)
    let configUpdate: unknown = undefined;
    if (isEnable) {
      try {
        const body = await request.json() as EnablePluginRequest;
        configUpdate = body.config;
      } catch {
        // If body parsing fails, treat as empty body (no config update)
        configUpdate = undefined;
      }
    }

    // 5. Update plugin via service
    const updatedPlugin = await updatePluginEnabled(
      tenantId,
      pluginId,
      isEnable,
      configUpdate
    );

    // 6. Check if plugin was found
    if (!updatedPlugin) {
      const errorResponse: ApiErrorResponse = {
        status: 404,
        message: 'Plugin not found',
        code: 'PLUGIN_NOT_FOUND',
      };
      return json(errorResponse, { status: 404 });
    }

    // 7. Transform to API response format (redact sensitive config)
    const pluginInfo: PluginInfo = {
      pluginId: updatedPlugin.pluginId,
      key: updatedPlugin.key,
      name: updatedPlugin.name,
      version: updatedPlugin.version,
      enabled: updatedPlugin.enabled,
      config: redactConfig(updatedPlugin.config),
      installedAt: updatedPlugin.createdAt.toISOString(),
      updatedAt: updatedPlugin.updatedAt.toISOString(),
    };

    const response: PluginActionResponse = {
      success: true,
      plugin: pluginInfo,
    };

    return json(response, { status: 200 });
  } catch (error) {
    // Log error for debugging
    console.error('Error updating plugin:', error);

    // Return generic error response
    const errorResponse: ApiErrorResponse = {
      status: 500,
      message: 'Failed to update plugin',
    };
    return json(errorResponse, { status: 500 });
  }
}
