/**
 * Widgets API - List Endpoint
 *
 * Provides API to list all available widgets from enabled plugins.
 * Widgets are defined in plugin.json files.
 *
 * Architecture:
 * - HTTP Request -> Resource Route (this file) -> Widgets Service -> Plugin Config Service
 * - Reads widget definitions from plugin.json files
 * - Only returns widgets from enabled plugins
 * - Enforces tenant context via requireAuth
 *
 * Endpoints:
 * - GET /api/widgets - List all available widgets
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { listAllWidgets } from '../services/widgets.service.js';

/**
 * GET /api/widgets - List all available widgets
 *
 * Returns catalog of widgets from all enabled plugins for the current tenant.
 * Each widget has an ID in format "pluginId:widgetKey".
 *
 * Response:
 * 200 OK
 * {
 *   widgets: [
 *     {
 *       id: "plugin-123:stats.signups",
 *       pluginId: "plugin-123",
 *       key: "stats.signups",
 *       type: "stat",
 *       title: "Signups (today)",
 *       version: "1.0"
 *     },
 *     ...
 *   ]
 * }
 *
 * Error Responses:
 * - 401 Unauthorized: Missing or invalid authentication
 * - 500 Internal Server Error: Failed to read plugin configurations
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check using requireAuth middleware
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. List all widgets from enabled plugins
    const widgets = await listAllWidgets(tenantId);

    // 3. Return success response
    return json({ widgets }, { status: 200 });
  } catch (error) {
    // Handle requireAuth() redirect (API should return 401 instead of redirect)
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle service layer errors
    if (error instanceof Error) {
      // Log detailed error for debugging
      console.error('Failed to list widgets:', error);

      // Return generic error message to client
      return json({ error: 'Failed to fetch widgets' }, { status: 500 });
    }

    // Handle unexpected errors
    console.error('Unexpected error in GET /api/widgets:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
