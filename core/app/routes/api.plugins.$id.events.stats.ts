/**
 * Plugin Events Statistics API
 *
 * Provides aggregated statistics for plugin events.
 * Returns counts by status and timestamp bounds.
 *
 * Endpoint:
 * - GET /api/plugins/:id/events/stats
 *
 * Security:
 * - Authentication required (requireAuth)
 * - Tenant isolation via service layer
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '../auth.middleware.js';
import { getPluginEventsStats } from '../../services/plugin-events.service.js';
import { getPluginByKey } from '../../services/plugin.service.js';

/**
 * GET /api/plugins/:id/events/stats - Get event statistics
 *
 * Returns aggregated counts and timestamp boundaries.
 * Useful for dashboard summaries and filtering UIs.
 *
 * Response:
 * 200 OK
 * {
 *   total: 150,
 *   processed: 120,
 *   failed: 10,
 *   pending: 20,
 *   latestIngestedAt: "2025-01-02T00:00:00.000Z",
 *   oldestIngestedAt: "2025-01-01T00:00:00.000Z"
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid plugin ID
 * - 401 Unauthorized: Not authenticated
 * - 500 Internal Server Error: Database error
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Get plugin key from URL params and resolve to UUID
    const pluginKey = params['id'];
    if (!pluginKey) {
      return json(
        {
          error: 'Plugin ID is required',
        },
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // Lookup plugin to get UUID
    const plugin = await getPluginByKey(tenantId, pluginKey);
    if (!plugin) {
      return json(
        {
          error: 'Plugin not found',
        },
        {
          status: 404,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // 3. Query statistics via service layer (use plugin UUID)
    const stats = await getPluginEventsStats(tenantId, plugin.pluginId);

    // 4. Build response
    return json(
      {
        total: stats.total,
        processed: stats.processed,
        failed: stats.failed,
        pending: stats.pending,
        latestIngestedAt: stats.latestIngestedAt?.toISOString() ?? null,
        oldestIngestedAt: stats.oldestIngestedAt?.toISOString() ?? null,
      },
      {
        status: 200,
        headers: {
          // Cache for 30 seconds to reduce load
          'Cache-Control': 'private, max-age=30',
        },
      }
    );
  } catch (error) {
    // Preserve Remix redirects
    if (error instanceof Response) {
      throw error;
    }

    // Log error for debugging
    console.error('Error getting plugin events statistics:', error);

    // Return generic error response
    return json(
      {
        error: 'Failed to get plugin events statistics',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
