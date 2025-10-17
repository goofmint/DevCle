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
import { withTenantContext } from '../../../db/connection.js';
import * as schema from '../../../db/schema/index.js';
import { eq, and, desc, asc } from 'drizzle-orm';
import { z } from 'zod';

/**
 * UUID validation schema
 */
const UuidSchema = z.string().uuid();

/**
 * Query parameters schema for activity listing
 */
const QueryParamsSchema = z.object({
  limit: z.number().int().positive().max(100).default(10),
  sortBy: z.enum(['occurredAt', 'action', 'source']).default('occurredAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * GET /api/developers/:id/activities
 *
 * Path Parameters:
 * - id: Developer ID (UUID)
 *
 * Query Parameters:
 * - limit: Number of activities to return (max 100, default 10)
 * - sortBy: Field to sort by (occurredAt, action, source, default: occurredAt)
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

    // 5. Fetch activities using Drizzle ORM with tenant context
    const activities = await withTenantContext(tenantId, async (tx) => {
      try {
        // Determine sort column
        const sortColumn =
          queryParams.sortBy === 'action'
            ? schema.activities.action
            : queryParams.sortBy === 'source'
            ? schema.activities.source
            : schema.activities.occurredAt;

        // Determine sort direction
        const sortOrder = queryParams.sortOrder === 'asc' ? asc : desc;

        // Query activities for the specified developer
        // RLS policy will automatically filter by tenant_id
        const result = await tx
          .select({
            activityId: schema.activities.activityId,
            action: schema.activities.action,
            source: schema.activities.source,
            occurredAt: schema.activities.occurredAt,
            metadata: schema.activities.metadata,
            value: schema.activities.value,
          })
          .from(schema.activities)
          .where(
            and(
              eq(schema.activities.tenantId, tenantId),
              eq(schema.activities.developerId, developerId)
            )
          )
          .orderBy(sortOrder(sortColumn))
          .limit(queryParams.limit);

        return result;
      } catch (error) {
        console.error('Failed to query activities:', error);
        throw new Error('Failed to retrieve activities from database');
      }
    });

    // 6. Return activities list (empty array if developer not found or has no activities)
    return json({ activities }, { status: 200 });
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
