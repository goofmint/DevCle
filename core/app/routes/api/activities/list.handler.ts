/**
 * Activity API - List Handler
 *
 * Handles GET /api/activities endpoint for listing activities.
 * Supports pagination, filtering, and sorting.
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '../../../auth.middleware.js';
import { listActivities, type ListActivitiesInput } from '../../../../services/activity.service.js';
import { z, type ZodError } from 'zod';

/**
 * Query parameter schema for list endpoint
 *
 * Validates all query parameters before passing to service layer.
 */
const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  developerId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  action: z.string().optional(),
  source: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  orderBy: z.enum(['occurred_at', 'recorded_at', 'ingested_at']).default('occurred_at'),
  orderDirection: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Handle GET /api/activities
 *
 * @param request - Remix request object
 * @returns JSON response with activities array and total count
 *
 * Query Parameters:
 * - limit: Number of records to return (max 1000, default 100)
 * - offset: Number of records to skip (default 0)
 * - developerId: Filter by developer ID (UUID, optional)
 * - accountId: Filter by account ID (UUID, optional)
 * - resourceId: Filter by resource ID (UUID, optional)
 * - action: Filter by action type (string, optional)
 * - source: Filter by data source (string, optional)
 * - fromDate: Filter by occurred_at >= fromDate (ISO 8601 string, optional)
 * - toDate: Filter by occurred_at <= toDate (ISO 8601 string, optional)
 * - orderBy: Field to sort by (default: 'occurred_at')
 * - orderDirection: Sort direction (default: 'desc')
 *
 * Response:
 * 200 OK: { activities: [...], total: number }
 * 400 Bad Request: Invalid query parameters
 * 401 Unauthorized: Missing or invalid authentication
 * 500 Internal Server Error: Database error
 */
export async function handleListActivities({ request }: LoaderFunctionArgs) {
  try {
    // 1. Authenticate user (throws redirect if not authenticated)
    // For API endpoints, we catch the redirect and return 401 instead
    let user;
    try {
      user = await requireAuth(request);
    } catch (error) {
      // If requireAuth throws a redirect (302), return 401 for API
      if (error instanceof Response && error.status === 302) {
        return json({ error: 'Unauthorized' }, { status: 401 });
      }
      throw error;
    }

    const tenantId = user.tenantId;

    // 2. Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = {
      limit: url.searchParams.get('limit') ?? undefined,
      offset: url.searchParams.get('offset') ?? undefined,
      developerId: url.searchParams.get('developerId') ?? undefined,
      accountId: url.searchParams.get('accountId') ?? undefined,
      resourceId: url.searchParams.get('resourceId') ?? undefined,
      action: url.searchParams.get('action') ?? undefined,
      source: url.searchParams.get('source') ?? undefined,
      fromDate: url.searchParams.get('fromDate') ?? undefined,
      toDate: url.searchParams.get('toDate') ?? undefined,
      orderBy: url.searchParams.get('orderBy') ?? undefined,
      orderDirection: url.searchParams.get('orderDirection') ?? undefined,
    };

    // 3. Validate query parameters using Zod schema
    const validated = ListQuerySchema.parse(queryParams);

    // 4. Build input for service layer
    const serviceInput: ListActivitiesInput = {
      limit: validated.limit,
      offset: validated.offset,
      developerId: validated.developerId,
      accountId: validated.accountId,
      resourceId: validated.resourceId,
      action: validated.action,
      source: validated.source,
      fromDate: validated.fromDate,
      toDate: validated.toDate,
      orderBy: validated.orderBy,
      orderDirection: validated.orderDirection,
    };

    // 5. Call service layer to fetch activities (returns { activities, total })
    const result = await listActivities(tenantId, serviceInput);

    // 6. Return JSON response with 200 OK
    return json(result, { status: 200 });
  } catch (error) {
    // Handle validation errors (Zod)
    if (error instanceof z.ZodError) {
      const zodError = error as ZodError<Record<string, unknown>>;
      return json(
        {
          error: 'Invalid query parameters',
          details: zodError.issues.reduce(
            (acc: Record<string, string[]>, issue) => {
              const field = issue.path.join('.');
              if (!acc[field]) {
                acc[field] = [];
              }
              acc[field].push(issue.message);
              return acc;
            },
            {} as Record<string, string[]>
          ),
        },
        { status: 400 }
      );
    }

    // Handle other errors
    console.error('Failed to list activities:', error);
    return json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
}
