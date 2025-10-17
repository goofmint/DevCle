/**
 * Overview Stats API - Resource Route
 *
 * Provides dashboard overview statistics.
 * Uses Overview Service for business logic.
 *
 * Architecture:
 * - HTTP Request -> Resource Route (this file) -> Overview Service -> Drizzle ORM -> PostgreSQL
 * - Handles HTTP-specific concerns (request/response, status codes, error handling)
 * - Delegates business logic to Overview Service
 * - Enforces tenant context via RLS
 *
 * Endpoints:
 * - GET /api/overview/stats - Get dashboard statistics
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { getOverviewStats } from '../../services/overview.service.js';

/**
 * GET /api/overview/stats - Get dashboard statistics
 *
 * Returns aggregated statistics for the dashboard overview page:
 * - Total number of developers
 * - Total number of activities
 * - Total number of campaigns
 * - Average ROI across all campaigns
 *
 * Response:
 * 200 OK
 * {
 *   stats: {
 *     totalDevelopers: 1234,
 *     totalActivities: 5678,
 *     totalCampaigns: 42,
 *     averageROI: 156.7
 *   }
 * }
 *
 * Error Responses:
 * - 401 Unauthorized: Missing or invalid authentication
 * - 500 Internal Server Error: Database error
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check using requireAuth middleware
    // This throws a redirect to /login if not authenticated
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Call service layer to get overview statistics
    // Service layer uses withTenantContext() for safe RLS with connection pooling
    const stats = await getOverviewStats(tenantId);

    // 3. Return success response with statistics
    // Wrapped in { stats } object to match API spec
    return json({ stats }, { status: 200 });
  } catch (error) {
    // 6. Handle errors and return appropriate HTTP status codes

    // Handle requireAuth() redirect (API should return 401 instead of redirect)
    // requireAuth() throws a Response with status 302 when user is not authenticated
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle service layer errors (database errors, business logic errors)
    if (error instanceof Error) {
      // Log detailed error for debugging
      console.error('Failed to get overview stats:', error);

      // Return generic error message to client (don't expose internal details)
      return json({ error: 'Failed to fetch overview stats' }, { status: 500 });
    }

    // Handle unexpected errors (shouldn't happen, but just in case)
    console.error('Unexpected error in GET /api/overview/stats:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
