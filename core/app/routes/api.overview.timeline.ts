/**
 * Overview Timeline API - Resource Route
 *
 * Provides time-series data for dashboard charts.
 * Uses Overview Service for business logic.
 *
 * Architecture:
 * - HTTP Request -> Resource Route (this file) -> Overview Service -> Drizzle ORM -> PostgreSQL
 * - Handles HTTP-specific concerns (request/response, status codes, error handling)
 * - Delegates business logic to Overview Service
 * - Enforces tenant context via RLS
 *
 * Endpoints:
 * - GET /api/overview/timeline - Get time-series data
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { getOverviewTimeline } from '../../services/overview.service.js';
import { z } from 'zod';

/**
 * Query Parameter Schema
 *
 * Validates query parameters for timeline endpoint.
 */
const TimelineQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

/**
 * GET /api/overview/timeline - Get time-series data
 *
 * Returns daily aggregated counts for dashboard charts:
 * - Number of activities per day
 * - Number of unique developers per day
 *
 * Query Parameters:
 * - days: Number of days to include (1-365, default 30)
 *
 * Response:
 * 200 OK
 * {
 *   timeline: [
 *     {
 *       date: "2025-10-01",
 *       activities: 120,
 *       developers: 45
 *     },
 *     ...
 *   ]
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid query parameters
 * - 401 Unauthorized: Missing or invalid authentication
 * - 500 Internal Server Error: Database error
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check using requireAuth middleware
    // This throws a redirect to /login if not authenticated
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Parse and validate query parameters
    const url = new URL(request.url);
    const rawParams = {
      days: url.searchParams.get('days') ?? undefined,
    };

    // Validate using Zod schema
    const params = TimelineQuerySchema.parse(rawParams);

    // 3. Call service layer to get timeline data
    // Service layer uses withTenantContext() to ensure RLS works correctly
    // This prevents data leakage between tenants when using connection pooling
    const timeline = await getOverviewTimeline(tenantId, params.days);

    // 4. Return success response with timeline data
    // Wrapped in { timeline } object to match API spec
    return json({ timeline }, { status: 200 });
  } catch (error) {
    // 5. Handle errors and return appropriate HTTP status codes

    // Handle requireAuth() redirect (API should return 401 instead of redirect)
    // requireAuth() throws a Response with status 302 when user is not authenticated
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle Zod validation errors (invalid query parameters)
    if (error instanceof z.ZodError) {
      return json(
        {
          error: 'Invalid query parameters',
          details: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Handle service layer errors (database errors, business logic errors)
    if (error instanceof Error) {
      // Log detailed error for debugging
      console.error('Failed to get overview timeline:', error);

      // Return generic error message to client (don't expose internal details)
      return json(
        { error: 'Failed to fetch overview timeline' },
        { status: 500 }
      );
    }

    // Handle unexpected errors (shouldn't happen, but just in case)
    console.error('Unexpected error in GET /api/overview/timeline:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
