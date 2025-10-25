/**
 * Funnel Timeline API - Resource Route
 *
 * Provides RESTful API for funnel time series analysis.
 * Uses Funnel Time Series Service for business logic.
 *
 * Architecture:
 * - HTTP Request -> Resource Route (this file) -> Funnel Time Series Service -> Drizzle ORM -> PostgreSQL
 * - Handles HTTP-specific concerns (request/response, status codes, error handling)
 * - Delegates business logic to Funnel Time Series Service
 * - Enforces tenant context via RLS
 *
 * Endpoints:
 * - GET /api/funnel/timeline - Get funnel time series data
 */

import {
  json,
  type LoaderFunctionArgs,
} from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import {
  getFunnelTimeSeries,
} from '../../services/funnel-timeseries.service.js';

/**
 * Response format for funnel timeline API
 *
 * Time series data with developer counts per stage per time period
 */
interface TimeSeriesDataPoint {
  date: string; // YYYY-MM-DD format
  awareness: number;
  engagement: number;
  adoption: number;
  advocacy: number;
}

/**
 * GET /api/funnel/timeline - Get funnel time series data
 *
 * Returns funnel statistics aggregated by time period (day/week/month).
 * Data is filtered by tenant ID (enforced via RLS).
 *
 * Query Parameters:
 * - interval: Time granularity ('daily', 'weekly', 'monthly', default: 'daily')
 * - fromDate: Start date (ISO 8601 format, default: 30 days ago)
 * - toDate: End date (ISO 8601 format, default: now)
 *
 * Response:
 * 200 OK
 * [
 *   {
 *     date: "2025-01-01",
 *     awareness: 10,
 *     engagement: 5,
 *     adoption: 2,
 *     advocacy: 1
 *   },
 *   ...
 * ]
 *
 * Error Responses:
 * - 400 Bad Request: Invalid query parameters (invalid date format or interval)
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
    const intervalParam = url.searchParams.get('interval') || 'daily';
    const fromDateParam = url.searchParams.get('fromDate');
    const toDateParam = url.searchParams.get('toDate');

    // 3. Validate and parse interval parameter
    // Map 'daily' to 'day', 'weekly' to 'week', 'monthly' to 'month'
    let granularity: 'day' | 'week' | 'month';
    if (intervalParam === 'daily' || intervalParam === 'day') {
      granularity = 'day';
    } else if (intervalParam === 'weekly' || intervalParam === 'week') {
      granularity = 'week';
    } else if (intervalParam === 'monthly' || intervalParam === 'month') {
      granularity = 'month';
    } else {
      // Invalid interval parameter
      return json(
        { error: 'Invalid interval parameter. Must be one of: daily, weekly, monthly' },
        { status: 400 }
      );
    }

    // 4. Parse and validate date parameters
    // Default: last 30 days for daily, last 12 weeks for weekly, last 12 months for monthly
    const now = new Date();
    let fromDate: Date;
    let toDate: Date = toDateParam ? new Date(toDateParam) : now;

    if (fromDateParam) {
      fromDate = new Date(fromDateParam);
    } else {
      // Set default fromDate based on granularity
      fromDate = new Date(now);
      if (granularity === 'day') {
        fromDate.setDate(fromDate.getDate() - 30); // Last 30 days
      } else if (granularity === 'week') {
        fromDate.setDate(fromDate.getDate() - 7 * 12); // Last 12 weeks
      } else {
        fromDate.setMonth(fromDate.getMonth() - 12); // Last 12 months
      }
    }

    // Validate date format (check if dates are valid)
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return json(
        { error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    // Validate date range (fromDate must be before or equal to toDate)
    if (fromDate.getTime() > toDate.getTime()) {
      return json(
        { error: 'Invalid date range. fromDate must be on or before toDate' },
        { status: 400 }
      );
    }

    // 5. Fetch time series data from service layer
    // Service function uses withTenantContext() for RLS enforcement
    const timeSeries = await getFunnelTimeSeries(
      tenantId,
      fromDate,
      toDate,
      granularity
    );

    // 6. Transform service response to API response format
    // Convert date objects to YYYY-MM-DD strings
    // Convert stages array to flat object with stage keys
    const response: TimeSeriesDataPoint[] = timeSeries.map((point) => {
      // Extract counts for each stage
      const awareness = point.stages.find(s => s.stageKey === 'awareness')?.uniqueDevelopers ?? 0;
      const engagement = point.stages.find(s => s.stageKey === 'engagement')?.uniqueDevelopers ?? 0;
      const adoption = point.stages.find(s => s.stageKey === 'adoption')?.uniqueDevelopers ?? 0;
      const advocacy = point.stages.find(s => s.stageKey === 'advocacy')?.uniqueDevelopers ?? 0;

      return {
        // Format date as YYYY-MM-DD (ISO 8601 date string, no time component)
        date: point.date.toISOString().split('T')[0] ?? '',
        awareness,
        engagement,
        adoption,
        advocacy,
      };
    });

    // 7. Return success response with time series data
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
      // Check for specific error messages from service layer

      // Invalid date range error from service (400 Bad Request)
      if (error.message.includes('Invalid date range')) {
        return json(
          { error: error.message },
          { status: 400 }
        );
      }

      // Invalid granularity error from service (400 Bad Request)
      if (error.message.includes('Invalid granularity')) {
        return json(
          { error: error.message },
          { status: 400 }
        );
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
