/**
 * Funnel API - Resource Route
 *
 * Provides RESTful API for funnel analysis data.
 * Uses Funnel Service for business logic.
 *
 * Architecture:
 * - HTTP Request -> Resource Route (this file) -> Funnel Service -> Drizzle ORM -> PostgreSQL
 * - Handles HTTP-specific concerns (request/response, status codes, error handling)
 * - Delegates business logic to Funnel Service
 * - Enforces tenant context via RLS
 *
 * Endpoints:
 * - GET /api/funnel - Get funnel statistics with drop rates
 */

import {
  json,
  type LoaderFunctionArgs,
} from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import {
  getFunnelStats,
  getFunnelDropRates,
  type FunnelStageKey,
} from '../../services/funnel.service.js';

/**
 * Response format for funnel statistics API
 *
 * Combines funnel statistics with drop rates for UI display
 */
interface FunnelApiResponse {
  stages: {
    stage: FunnelStageKey;
    stageName: string;
    count: number;
    dropRate: number | null;
  }[];
  totalDevelopers: number;
  periodStart: string;
  periodEnd: string;
}

/**
 * GET /api/funnel - Get funnel statistics with drop rates
 *
 * Returns funnel statistics for all stages with drop rates calculated.
 * Data is filtered by tenant ID (enforced via RLS).
 *
 * Response:
 * 200 OK
 * {
 *   stages: [
 *     {
 *       stage: "awareness",
 *       stageName: "Awareness",
 *       count: 100,
 *       dropRate: null
 *     },
 *     {
 *       stage: "engagement",
 *       stageName: "Engagement",
 *       count: 30,
 *       dropRate: 70
 *     },
 *     ...
 *   ],
 *   totalDevelopers: 100,
 *   periodStart: "2025-01-01T00:00:00.000Z",
 *   periodEnd: "2025-01-31T23:59:59.999Z"
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

    // 2. Fetch funnel statistics and drop rates from service layer
    // Both functions use withTenantContext() for RLS enforcement
    const [stats, dropRates] = await Promise.all([
      getFunnelStats(tenantId),
      getFunnelDropRates(tenantId),
    ]);

    // 3. Merge statistics and drop rates for response
    // The API response format matches the interface expected by the UI
    const response: FunnelApiResponse = {
      stages: stats.stages.map((stageStat) => {
        // Find corresponding drop rate for this stage
        const dropRateStat = dropRates.stages.find(
          (dr) => dr.stageKey === stageStat.stageKey
        );

        return {
          stage: stageStat.stageKey,
          stageName: stageStat.title,
          count: stageStat.uniqueDevelopers,
          dropRate: dropRateStat?.dropRate ?? null,
        };
      }),
      totalDevelopers: stats.totalDevelopers,
      // Period is full date range (all activities)
      // TODO: Add date filtering support in future (query params: fromDate, toDate)
      periodStart: new Date(0).toISOString(), // Beginning of time
      periodEnd: new Date().toISOString(), // Now
    };

    // 4. Return success response with funnel statistics
    return json(response, { status: 200 });
  } catch (error) {
    // Handle errors and return appropriate HTTP status codes

    // Handle requireAuth() redirect (API should return 401 instead of redirect)
    // requireAuth() throws a Response with status 302 when user is not authenticated
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle service layer errors (database errors, business logic errors)
    if (error instanceof Error) {
      // Log detailed error for debugging
      console.error('Failed to get funnel statistics:', error);

      // Return generic error message to client (don't expose internal details)
      return json({ error: 'Failed to fetch funnel statistics' }, { status: 500 });
    }

    // Handle unexpected errors (shouldn't happen, but just in case)
    console.error('Unexpected error in GET /api/funnel:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
