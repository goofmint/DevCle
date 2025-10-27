/**
 * Plugin configuration API endpoint
 * GET /api/plugins/:id/config
 */

import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { getPluginConfig } from '~/services/plugin/plugin-config.service.js';

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

  if (!pluginId) {
    return json({ error: 'Plugin ID is required' }, { status: 400 });
  }

  try {
    // Fetch plugin configuration
    const config = await getPluginConfig(pluginId, user.tenantId);

    return json(config);
  } catch (error) {
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('Plugin not found')) {
        return json({ error: 'Plugin not found' }, { status: 404 });
      }

      if (error.message.includes('Invalid plugin.json')) {
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
