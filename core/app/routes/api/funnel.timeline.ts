/**
 * Funnel Timeline API - Resource Route
 *
 * Provides time series data for funnel analysis.
 * Uses Funnel Service (Task 6.2) for business logic.
 *
 * Architecture:
 * - HTTP Request -> Resource Route (this file) -> Funnel Service -> Drizzle ORM -> PostgreSQL
 * - Handles HTTP-specific concerns (request/response, status codes, error handling)
 * - Delegates business logic to Funnel Service
 * - Enforces tenant context via RLS
 *
 * Endpoints:
 * - GET    /api/funnel/timeline       - Get time series funnel data
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
import { getFunnelTimeSeries } from '../../../services/funnel.service.js';
import { z } from 'zod';

/**
 * Query parameter validation schema
 *
 * Validates query parameters for timeline endpoint:
 * - fromDate: ISO 8601 date string (YYYY-MM-DD)
 * - toDate: ISO 8601 date string (YYYY-MM-DD)
 * - granularity: one of 'day', 'week', 'month'
 */
const TimelineQuerySchema = z.object({
  fromDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Expected YYYY-MM-DD'),
  toDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Expected YYYY-MM-DD'),
  granularity: z.enum(['day', 'week', 'month'], {
    message: "Invalid granularity. Expected 'day', 'week', or 'month'",
  }),
});

/**
 * GET /api/funnel/timeline - Get time series funnel data
 *
 * Returns funnel statistics aggregated by time period (day, week, or month).
 * Each data point contains unique developer counts and drop rates for all 4 stages.
 *
 * Query Parameters:
 * - fromDate: Start date (ISO 8601 format, YYYY-MM-DD, required)
 * - toDate: End date (ISO 8601 format, YYYY-MM-DD, required)
 * - granularity: Time granularity ('day', 'week', 'month', required)
 *
 * Example Request:
 * GET /api/funnel/timeline?fromDate=2024-01-01&toDate=2024-01-31&granularity=week
 *
 * Response:
 * 200 OK
 * [
 *   {
 *     date: "2024-01-01T00:00:00.000Z",
 *     stages: [
 *       {
 *         stageKey: "awareness",
 *         uniqueDevelopers: 50,
 *         dropRate: null
 *       },
 *       {
 *         stageKey: "engagement",
 *         uniqueDevelopers: 15,
 *         dropRate: 70.0
 *       },
 *       ...
 *     ]
 *   },
 *   ...
 * ]
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

    // 2. Parse query parameters from URL
    const url = new URL(request.url);
    const rawParams = {
      fromDate: url.searchParams.get('fromDate'),
      toDate: url.searchParams.get('toDate'),
      granularity: url.searchParams.get('granularity'),
    };

    // 3. Validate query parameters using Zod schema
    const validationResult = TimelineQuerySchema.safeParse(rawParams);
    if (!validationResult.success) {
      // Return 400 Bad Request with validation error details
      return json(
        {
          error: 'Invalid query parameters',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Extract validated parameters
    const { fromDate, toDate, granularity } = validationResult.data;

    // 4. Call service layer to get time series funnel data
    // Convert date strings to Date objects for service layer
    const timeSeries = await getFunnelTimeSeries(
      tenantId,
      new Date(fromDate),
      new Date(toDate),
      granularity
    );

    // 5. Return success response with time series data
    return json(timeSeries, { status: 200 });
  } catch (error) {
    // Handle errors and return appropriate HTTP status codes

    // Handle requireAuth() redirect (API should return 401 instead of redirect)
    // requireAuth() throws a Response with status 302 when user is not authenticated
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle service layer errors (database errors, business logic errors)
    if (error instanceof Error) {
      // Check for specific error messages from service layer

      // Invalid date range (fromDate > toDate)
      if (error.message.includes('Invalid date range')) {
        return json({ error: 'Invalid date range' }, { status: 400 });
      }

      // Log detailed error for debugging
      console.error('Failed to get funnel timeline:', error);

      // Return generic error message to client (don't expose internal details)
      return json({ error: 'Failed to fetch funnel timeline' }, { status: 500 });
    }

    // Handle unexpected errors (shouldn't happen, but just in case)
    console.error('Unexpected error in GET /api/funnel/timeline:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
