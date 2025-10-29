/**
 * Widget Data API - Specific Widget Data Endpoint
 *
 * Provides API to fetch data for a specific widget.
 * Reads widget definition from plugin.json and executes data query.
 *
 * Architecture:
 * - HTTP Request -> Resource Route (this file) -> Widgets Service -> Widget Data Service -> Drizzle ORM
 * - Parses widgetId (format: "pluginId:widgetKey")
 * - Fetches widget definition from plugin.json
 * - Executes declarative query based on dataSource
 * - Returns formatted data matching widget type
 * - Enforces tenant isolation via RLS
 *
 * Endpoints:
 * - GET /api/widgets/:widgetId/data - Get widget data
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { getWidgetData } from '../services/widgets.service.js';

/**
 * GET /api/widgets/:widgetId/data - Get specific widget data
 *
 * Fetches data for a widget based on its dataSource definition in plugin.json.
 * widgetId format: "pluginId:widgetKey" (e.g., "plugin-123:stats.signups")
 *
 * Response:
 * 200 OK - Returns widget data matching widget type (stat, table, list, timeseries, card)
 *
 * Example for stat widget:
 * {
 *   version: "1.0",
 *   type: "stat",
 *   title: "Signups (today)",
 *   data: {
 *     value: 142,
 *     trend: {
 *       value: 12.5,
 *       direction: "up"
 *     }
 *   }
 * }
 *
 * Example for timeseries widget:
 * {
 *   version: "1.0",
 *   type: "timeseries",
 *   title: "GitHub Activities (30d)",
 *   data: {
 *     interval: "day",
 *     series: [
 *       {
 *         label: "PRs",
 *         points: [["2025-10-01", 5], ["2025-10-02", 7]]
 *       }
 *     ]
 *   }
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid widgetId format
 * - 401 Unauthorized: Missing or invalid authentication
 * - 404 Not Found: Widget not found or plugin disabled
 * - 500 Internal Server Error: Query execution failed
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check using requireAuth middleware
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Extract and validate widgetId parameter
    const widgetId = params['widgetId'];
    if (!widgetId) {
      return json({ error: 'Widget ID is required' }, { status: 400 });
    }

    // Validate widgetId format (should be "pluginId:widgetKey")
    if (!widgetId.includes(':')) {
      return json(
        { error: 'Invalid widget ID format. Expected "pluginId:widgetKey"' },
        { status: 400 }
      );
    }

    // 3. Fetch widget data (reads plugin.json, executes query)
    const widgetData = await getWidgetData(tenantId, widgetId);

    // 4. Return success response with widget data
    return json(widgetData, { status: 200 });
  } catch (error) {
    // Handle requireAuth() redirect (API should return 401 instead of redirect)
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle service layer errors
    if (error instanceof Error) {
      // Check for specific error messages

      // Widget not found or plugin disabled (404)
      if (
        error.message.includes('not found') ||
        error.message.includes('disabled')
      ) {
        return json({ error: error.message }, { status: 404 });
      }

      // Invalid widget ID format (400)
      if (error.message.includes('Invalid widget ID')) {
        return json({ error: error.message }, { status: 400 });
      }

      // Log detailed error for debugging
      console.error('Failed to fetch widget data:', error);

      // Return generic error message to client
      return json({ error: 'Failed to fetch widget data' }, { status: 500 });
    }

    // Handle unexpected errors
    console.error('Unexpected error in GET /api/widgets/:widgetId/data:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
