/**
 * Plugin Configuration API Endpoint
 *
 * Handles plugin configuration retrieval and updates:
 * - GET /api/plugins/:id/config - Retrieve plugin configuration schema
 * - PUT /api/plugins/:id/config - Update plugin configuration values
 *
 * Features:
 * - Automatic encryption of secret fields
 * - Schema-based validation
 * - Non-fail-fast validation (collects all errors)
 * - Secret exists marker support ({ _exists: true })
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { getPluginConfig } from '../../services/plugin/plugin-config.service.js';
import { updatePluginConfig, getPluginById } from '../../services/plugin.service.js';
import { validatePluginConfig } from '../../plugin-system/config-validator.js';
import type { PluginConfigSchema } from '../../plugin-system/config-validator.js';
import { isValidUUID } from '~/utils/validation.js';

/**
 * GET /api/plugins/:id/config
 *
 * Retrieves plugin configuration information including:
 * - Basic information (name, version, description, vendor, license)
 * - Capabilities (scopes, network, secrets)
 * - Settings schema
 * - Routes
 * - Menus, widgets, jobs (if defined)
 *
 * @returns PluginConfigInfo JSON
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  // Authenticate user
  const user = await requireAuth(request);

  // Get plugin ID from params
  const { id: pluginId } = params;

  // Validate plugin ID
  if (!pluginId) {
    return json({ error: 'Plugin ID is required' }, { status: 400 });
  }

  // Prevent path traversal
  if (pluginId.includes('..') || pluginId.includes('/') || pluginId.includes('\\')) {
    return json({ error: 'Invalid plugin ID' }, { status: 400 });
  }

  try {
    // Get plugin from database to get the key
    const plugin = await getPluginById(user.tenantId, pluginId);

    if (!plugin) {
      return json({ error: 'Plugin not found' }, { status: 404 });
    }

    // Fetch plugin configuration using plugin.key (not pluginId)
    const config = await getPluginConfig(plugin.key, user.tenantId);

    return json(config);
  } catch (error) {
    // Handle specific errors
    if (error instanceof Error) {
      // Path traversal detected
      if (error.message.includes('path traversal')) {
        return json({ error: 'Invalid plugin ID' }, { status: 400 });
      }

      // Plugin not found
      if (error.message.includes('Plugin not found')) {
        return json({ error: 'Plugin not found' }, { status: 404 });
      }

      // Malformed or invalid manifest
      if (error.message.includes('malformed') || error.message.includes('invalid')) {
        return json(
          { error: 'Invalid plugin configuration' },
          { status: 500 }
        );
      }
    }

    // Generic error response
    return json({ error: 'Failed to load plugin configuration' }, { status: 500 });
  }
}

/**
 * PUT /api/plugins/:id/config - Update plugin configuration
 *
 * Updates plugin configuration with automatic encryption of secret fields.
 * Validates all fields against schema and collects all errors (non-fail-fast).
 *
 * Request Body:
 * {
 *   "config": {
 *     "fieldName": value,
 *     "secretField": { _exists: true } | "newValue"
 *   }
 * }
 *
 * Response (Success):
 * {
 *   "success": true,
 *   "plugin": {
 *     "pluginId": "uuid",
 *     "key": "plugin-key",
 *     "name": "Plugin Name",
 *     "enabled": true,
 *     "updatedAt": "2025-01-01T00:00:00.000Z"
 *   }
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Validation errors (details array contains all errors)
 * - 401 Unauthorized: Not authenticated
 * - 403 Forbidden: Not admin role
 * - 404 Not Found: Plugin not found or no config schema
 * - 500 Internal Server Error: Database, encryption, or schema loading error
 */
export async function action({ request, params }: ActionFunctionArgs) {
  try {
    // 1. Authentication check (admin role required)
    const user = await requireAuth(request);

    // Check admin role
    if (user.role !== 'admin') {
      return json(
        {
          status: 403,
          error: 'Admin role required to edit plugin configuration',
        },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // 2. Validate plugin ID format
    const pluginId = params['id'];
    if (!isValidUUID(pluginId)) {
      return json(
        {
          status: 400,
          error: 'Invalid plugin ID format (must be UUID)',
        },
        { status: 400 }
      );
    }

    // 3. Parse request body
    let requestBody: { config?: unknown };
    try {
      requestBody = await request.json();
    } catch (error) {
      return json(
        {
          status: 400,
          error: 'Invalid JSON in request body',
        },
        { status: 400 }
      );
    }

    // Validate config field exists
    if (!requestBody.config || typeof requestBody.config !== 'object') {
      return json(
        {
          status: 400,
          error: 'Request body must contain "config" object',
        },
        { status: 400 }
      );
    }

    const config = requestBody.config as Record<string, unknown>;

    // 4. Get plugin from database to get the key, then load schema
    let plugin;
    try {
      plugin = await getPluginById(tenantId, pluginId);
    } catch (error) {
      console.error('[PUT /api/plugins/:id/config] Failed to get plugin:', error);

      // Check if this is a "not found" error
      if (error instanceof Error && error.message.includes('Plugin not found')) {
        return json(
          {
            status: 404,
            error: 'Plugin not found',
          },
          { status: 404 }
        );
      }

      // Otherwise, return generic 500 error
      return json(
        {
          status: 500,
          error: 'Failed to retrieve plugin information',
        },
        { status: 500 }
      );
    }

    // 5. Get plugin configuration schema from plugin.json (use plugin.key, not pluginId)
    let pluginConfig: { settingsSchema?: { fields?: unknown[] } };
    try {
      pluginConfig = await getPluginConfig(plugin.key, tenantId);
    } catch (error) {
      // Log error for debugging
      console.error('[PUT /api/plugins/:id/config] Failed to load plugin schema:', error);

      // Check if plugin not found
      if (error instanceof Error && error.message.includes('Plugin not found')) {
        return json(
          {
            status: 404,
            error: 'Plugin configuration not found',
          },
          { status: 404 }
        );
      }

      // Schema loading failed
      return json(
        {
          status: 500,
          error: 'Failed to load plugin configuration schema',
        },
        { status: 500 }
      );
    }

    // Check if plugin has settings schema
    if (!pluginConfig.settingsSchema || !Array.isArray(pluginConfig.settingsSchema)) {
      return json(
        {
          status: 404,
          error: 'Plugin does not have a configuration schema',
        },
        { status: 404 }
      );
    }

    const schema: PluginConfigSchema = {
      fields: pluginConfig.settingsSchema as PluginConfigSchema['fields'],
    };

    // 6. Validate configuration against schema (collect all errors)
    const validationErrors = validatePluginConfig(schema, config);

    if (validationErrors.length > 0) {
      return json(
        {
          status: 400,
          error: 'Validation failed',
          details: validationErrors,
        },
        { status: 400 }
      );
    }

    // 7. Update plugin configuration (encryption handled by service)
    let updatedPlugin;
    try {
      updatedPlugin = await updatePluginConfig(tenantId, pluginId, schema, config);
    } catch (error) {
      // Log error for debugging
      console.error('[PUT /api/plugins/:id/config] Failed to update plugin config:', error);

      // Check specific error types
      if (error instanceof Error) {
        if (error.message.includes('Plugin not found')) {
          return json(
            {
              status: 404,
              error: 'Plugin not found',
            },
            { status: 404 }
          );
        }

        if (error.message.includes('encrypt')) {
          return json(
            {
              status: 500,
              error: 'Failed to encrypt configuration',
            },
            { status: 500 }
          );
        }
      }

      // Generic database error
      return json(
        {
          status: 500,
          error: 'Failed to update plugin configuration',
        },
        { status: 500 }
      );
    }

    // 8. Return success response
    return json(
      {
        success: true,
        plugin: {
          pluginId: updatedPlugin.pluginId,
          key: updatedPlugin.key,
          name: updatedPlugin.name,
          enabled: updatedPlugin.enabled,
          updatedAt: updatedPlugin.updatedAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    // Log unexpected errors
    console.error('[PUT /api/plugins/:id/config] Unexpected error:', error);

    // Return generic error response
    return json(
      {
        status: 500,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
