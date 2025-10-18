/**
 * Developer Activities API - Get activities for a developer
 *
 * Endpoint: GET /api/developers/:id/activities
 *
 * Returns list of activities performed by a developer.
 * Supports pagination and sorting via query parameters.
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { listActivities } from '../../services/activity-list.service.js';
import { z } from 'zod';

/**
 * UUID validation schema
 */
const UuidSchema = z.string().uuid();

/**
 * Query parameters schema for activity listing
 * Supported sortBy values map to DB columns: occurredAt -> occurred_at, recordedAt -> recorded_at, ingestedAt -> ingested_at
 */
const QueryParamsSchema = z.object({
  limit: z.number().int().positive().max(100).default(10),
  sortBy: z.enum(['occurredAt', 'recordedAt', 'ingestedAt']).default('occurredAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Map camelCase client sortBy values to snake_case DB column names
 */
const SORT_BY_MAPPING: Record<'occurredAt' | 'recordedAt' | 'ingestedAt', 'occurred_at' | 'recorded_at' | 'ingested_at'> = {
  occurredAt: 'occurred_at',
  recordedAt: 'recorded_at',
  ingestedAt: 'ingested_at',
};

/**
 * GET /api/developers/:id/activities
 *
 * Path Parameters:
 * - id: Developer ID (UUID)
 *
 * Query Parameters:
 * - limit: Number of activities to return (max 100, default 10)
 * - sortBy: Field to sort by (occurredAt, recordedAt, ingestedAt, default: occurredAt)
 * - sortOrder: Sort direction (asc, desc, default: desc)
 *
 * Response:
 * 200 OK
 * {
 *   activities: [
 *     {
 *       activityId: "uuid",
 *       action: "star",
 *       source: "github",
 *       occurredAt: "2025-01-01T00:00:00Z",
 *       metadata: {...}
 *     }
 *   ]
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid developer ID or query parameters
 * - 401 Unauthorized: Missing or invalid authentication
 * - 500 Internal Server Error: Database error
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Extract developer ID from URL params
    const developerId = params['id'];

    // Validate that ID was provided
    if (!developerId) {
      return json({ error: 'Developer ID is required' }, { status: 400 });
    }

    // 3. Validate developer ID format (must be valid UUID)
    try {
      UuidSchema.parse(developerId);
    } catch (validationError) {
      return json({ error: 'Invalid developer ID format' }, { status: 400 });
    }

    // 4. Parse and validate query parameters
    const url = new URL(request.url);
    const rawQueryParams = {
      limit: url.searchParams.get('limit')
        ? Number(url.searchParams.get('limit'))
        : undefined,
      sortBy: url.searchParams.get('sortBy') || undefined,
      sortOrder: url.searchParams.get('sortOrder') || undefined,
    };

    // Validate query params with defaults
    const queryParams = QueryParamsSchema.parse(rawQueryParams);

    // 5. Fetch activities using service layer
    // Map camelCase sortBy to snake_case DB column name
    const orderBy = SORT_BY_MAPPING[queryParams.sortBy];
    const result = await listActivities(tenantId, {
      developerId,
      limit: queryParams.limit,
      orderBy,
      orderDirection: queryParams.sortOrder,
    });

    // 6. Return activities list (empty array if developer not found or has no activities)
    return json({ activities: result.activities }, { status: 200 });
  } catch (error) {
    // 7. Handle errors

    // Handle requireAuth() redirect
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return json(
        {
          error: 'Invalid query parameters',
          details: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Handle service layer errors
    if (error instanceof Error) {
      console.error('Failed to list activities:', error);
      return json(
        { error: 'Failed to retrieve activities' },
        { status: 500 }
      );
    }

    // Handle unexpected errors
    console.error('Unexpected error in GET /api/developers/:id/activities:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
