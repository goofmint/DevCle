/**
 * Plugin Event Reprocess API
 *
 * Queues an event for reprocessing by resetting its status to 'pending'.
 * Used to retry failed events or reprocess after logic changes.
 *
 * Endpoint:
 * - POST /api/plugins/:id/events/:eventId/reprocess
 *
 * Security:
 * - Authentication required (requireAuth)
 * - Rate limiting (10 requests per minute per user/IP)
 * - Tenant isolation via service layer
 */

import { json, type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '../auth.middleware.js';
import { applyRateLimit, getClientIp } from '../../middleware/rate-limiter.js';
import { reprocessEvent } from '../../services/plugin-events.service.js';
import { getPluginByKey } from '../services/plugins.service.js';

/**
 * POST /api/plugins/:id/events/:eventId/reprocess - Reprocess event
 *
 * Resets event status to 'pending' and clears error state.
 * The event will be picked up by the background job processor.
 *
 * Rate Limit:
 * - 10 requests per minute per authenticated user
 * - Falls back to IP-based limiting for unauthenticated requests
 * - Returns 429 Too Many Requests with Retry-After header
 *
 * Response:
 * 200 OK
 * {
 *   success: true,
 *   message: "Reprocessing queued"
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid plugin ID or event ID
 * - 401 Unauthorized: Not authenticated
 * - 404 Not Found: Event not found
 * - 429 Too Many Requests: Rate limit exceeded
 * - 500 Internal Server Error: Database error
 */
export async function action({ request, params }: ActionFunctionArgs) {
  try {
    // 1. Authentication check
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Apply rate limiting
    const clientIp = getClientIp(request);
    await applyRateLimit(user.userId, clientIp);

    // 3. Get plugin key and event ID from URL params
    const pluginKey = params['id'];
    const eventId = params['eventId'];

    if (!pluginKey) {
      return json(
        {
          success: false,
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

    if (!eventId) {
      return json(
        {
          success: false,
          error: 'Event ID is required',
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
          success: false,
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

    // 4. Queue reprocessing via service layer (use plugin UUID)
    try {
      await reprocessEvent(tenantId, plugin.pluginId, eventId);
    } catch (error) {
      // Handle event not found
      if (error instanceof Error && error.message === 'Event not found') {
        return json(
          {
            success: false,
            error: 'Event not found',
          },
          {
            status: 404,
            headers: {
              'Cache-Control': 'no-store',
            },
          }
        );
      }
      throw error;
    }

    // 5. Return success response
    return json(
      {
        success: true,
        message: 'Reprocessing queued',
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    // Preserve Remix redirects
    if (error instanceof Response) {
      throw error;
    }

    // Log error for debugging
    console.error('Error reprocessing plugin event:', error);

    // Return generic error response
    return json(
      {
        success: false,
        error: 'Failed to reprocess plugin event',
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
