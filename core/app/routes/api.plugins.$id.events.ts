/**
 * Plugin Events List API
 *
 * Provides paginated list of plugin events with filtering and sorting.
 * Returns event metadata without raw data for performance.
 *
 * Endpoint:
 * - GET /api/plugins/:id/events?page=1&perPage=20&status=pending&eventType=github:pull_request&sort=desc
 *
 * Security:
 * - Authentication required (requireAuth)
 * - Tenant isolation via service layer
 * - Input validation via Zod schemas
 * - Raw data excluded from list responses
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '../auth.middleware.js';
import { listPluginEvents, ListEventsSchema } from '../../services/plugin-events.service.js';

/**
 * GET /api/plugins/:id/events - List plugin events
 *
 * Returns paginated list of events with filtering and sorting options.
 * Does not include raw_data field for performance (use detail endpoint).
 *
 * Query Parameters:
 * - page: Page number (>= 1, default: 1)
 * - perPage: Items per page (1-100, default: 20)
 * - status: Filter by status ('pending' | 'processed' | 'failed', optional)
 * - eventType: Filter by event type (e.g., 'github:pull_request', optional)
 * - startDate: Filter by start date (ISO 8601, optional)
 * - endDate: Filter by end date (ISO 8601, optional)
 * - sort: Sort order ('asc' | 'desc', default: 'desc')
 *
 * Response:
 * 200 OK
 * {
 *   items: [
 *     {
 *       eventId: "uuid",
 *       eventType: "github:pull_request",
 *       status: "processed",
 *       ingestedAt: "2025-01-01T00:00:00.000Z",
 *       processedAt: "2025-01-01T00:01:00.000Z",
 *       errorMessage: null
 *     }
 *   ],
 *   pagination: {
 *     total: 100,
 *     page: 1,
 *     perPage: 20,
 *     totalPages: 5
 *   }
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid query parameters
 * - 401 Unauthorized: Not authenticated
 * - 500 Internal Server Error: Database error
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Get plugin ID from URL params
    const pluginId = params['id'];
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

    // 3. Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = {
      page: url.searchParams.get('page'),
      perPage: url.searchParams.get('perPage'),
      status: url.searchParams.get('status'),
      eventType: url.searchParams.get('eventType'),
      startDate: url.searchParams.get('startDate'),
      endDate: url.searchParams.get('endDate'),
      sort: url.searchParams.get('sort'),
    };

    // Validate with Zod schema
    const validatedQuery = ListEventsSchema.parse(queryParams);

    // 4. Query events via service layer
    const result = await listPluginEvents(tenantId, pluginId, validatedQuery);

    // 5. Build response
    return json(
      {
        items: result.items.map((item) => ({
          ...item,
          ingestedAt: item.ingestedAt.toISOString(),
          processedAt: item.processedAt?.toISOString() ?? null,
        })),
        pagination: {
          total: result.total,
          page: validatedQuery.page,
          perPage: validatedQuery.perPage,
          totalPages: Math.ceil(result.total / validatedQuery.perPage),
        },
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

    // Handle Zod validation errors
    if (error && typeof error === 'object' && 'issues' in error) {
      return json(
        {
          error: 'Invalid query parameters',
          details: error,
        },
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // Log error for debugging
    console.error('Error listing plugin events:', error);

    // Return generic error response
    return json(
      {
        error: 'Failed to list plugin events',
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
