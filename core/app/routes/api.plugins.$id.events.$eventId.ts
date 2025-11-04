/**
 * Plugin Event Detail API
 *
 * Provides detailed information for a single plugin event.
 * Includes raw data with sensitive fields automatically masked.
 *
 * Endpoint:
 * - GET /api/plugins/:id/events/:eventId
 *
 * Security:
 * - Authentication required (requireAuth)
 * - Tenant isolation via service layer
 * - Automatic sensitive data masking (tokens, keys, passwords)
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '../auth.middleware.js';
import { getPluginEventDetail } from '../../services/plugin-events.service.js';

/**
 * GET /api/plugins/:id/events/:eventId - Get event detail
 *
 * Returns full event information including masked raw data.
 * Sensitive fields are automatically redacted for security.
 *
 * Response:
 * 200 OK
 * {
 *   eventId: "uuid",
 *   eventType: "github:pull_request",
 *   status: "processed",
 *   ingestedAt: "2025-01-01T00:00:00.000Z",
 *   processedAt: "2025-01-01T00:01:00.000Z",
 *   errorMessage: null,
 *   rawData: {
 *     // Sensitive fields masked: token, api_key, password, etc.
 *     user: "developer",
 *     repo: "my-repo",
 *     token: "ghp_***xyz"  // Masked
 *   },
 *   activityId: "uuid"  // If event was processed into activity
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid plugin ID or event ID
 * - 401 Unauthorized: Not authenticated
 * - 404 Not Found: Event not found
 * - 500 Internal Server Error: Database error
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Get plugin ID and event ID from URL params
    const pluginId = params['id'];
    const eventId = params['eventId'];

    if (!pluginId) {
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

    if (!eventId) {
      return json(
        {
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

    // 3. Query event detail via service layer (with automatic masking)
    const event = await getPluginEventDetail(tenantId, pluginId, eventId);

    if (!event) {
      return json(
        {
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

    // 4. Build response (service already masked sensitive data)
    return json(
      {
        eventId: event.eventId,
        eventType: event.eventType,
        status: event.status,
        ingestedAt: event.ingestedAt.toISOString(),
        processedAt: event.processedAt?.toISOString() ?? null,
        errorMessage: event.errorMessage,
        rawData: event.rawData, // Already masked by service
        activityId: event.activityId,
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
    console.error('Error getting plugin event detail:', error);

    // Return generic error response
    return json(
      {
        error: 'Failed to get plugin event detail',
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
