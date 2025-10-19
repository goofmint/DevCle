/**
 * Funnel API - Resource Route
 *
 * Provides RESTful API for funnel analysis.
 * Uses Funnel Service (Task 6.1, 6.2) for business logic.
 *
 * Architecture:
 * - HTTP Request -> Resource Route (this file) -> Funnel Service -> Drizzle ORM -> PostgreSQL
 * - Handles HTTP-specific concerns (request/response, status codes, error handling)
 * - Delegates business logic to Funnel Service
 * - Enforces tenant context via RLS
 *
 * Endpoints:
 * - GET    /api/funnel       - Get overall funnel statistics with drop rates
 *
 * Authentication:
 * - All endpoints require authentication
 * - Session-based authentication (cookie)
 * - Tenant ID is extracted from session
 *
 * RLS (Row Level Security):
 * - Tenant context is set based on authenticated user's tenant_id
 * - All database queries are automatically filtered by tenant
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import {
  getFunnelStats,
  getFunnelDropRates,
} from '../../../services/funnel.service.js';

/**
 * GET /api/funnel - Get overall funnel statistics
 *
 * Returns funnel statistics for all 4 stages (Awareness, Engagement, Adoption, Advocacy)
 * with drop rates and overall conversion rate.
 *
 * Response:
 * 200 OK
 * {
 *   stages: [
 *     {
 *       stageKey: "awareness",
 *       title: "Awareness",
 *       orderNo: 1,
 *       uniqueDevelopers: 100,
 *       totalActivities: 250,
 *       previousStageCount: null,
 *       dropRate: null
 *     },
 *     {
 *       stageKey: "engagement",
 *       title: "Engagement",
 *       orderNo: 2,
 *       uniqueDevelopers: 30,
 *       totalActivities: 80,
 *       previousStageCount: 100,
 *       dropRate: 70.0
 *     },
 *     ...
 *   ],
 *   overallConversionRate: 5.0
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

    // 2. Call service layer to get funnel statistics and drop rates
    // These are two separate queries, but they use the same underlying data
    // Future optimization: combine into single query
    const stats = await getFunnelStats(tenantId);
    const dropRates = await getFunnelDropRates(tenantId);

    // 3. Merge statistics and drop rates
    // Each stage needs: basic stats (from getFunnelStats) + drop rate data (from getFunnelDropRates)
    const mergedStages = stats.stages.map((stage) => {
      // Find corresponding drop rate data for this stage
      const dropRateData = dropRates.stages.find(
        (d) => d.stageKey === stage.stageKey
      );

      // Merge the two data structures
      return {
        ...stage,
        previousStageCount: dropRateData?.previousStageCount ?? null,
        dropRate: dropRateData?.dropRate ?? null,
      };
    });

    // 4. Return success response with merged data
    return json(
      {
        stages: mergedStages,
        overallConversionRate: dropRates.overallConversionRate,
      },
      { status: 200 }
    );
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
