/**
 * Activity API - Update Handler
 *
 * Handles PUT /api/activities/:id endpoint for updating activities.
 * Updates are RARE - only for data correction or developer ID resolution.
 */

import { json, type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '../../../auth.middleware.js';
import { updateActivity, type UpdateActivityInput } from '../../../../services/activity.service.js';
import { z, type ZodError } from 'zod';

/**
 * UUID validation schema
 */
const UuidSchema = z.string().uuid();

/**
 * Handle PUT /api/activities/:id
 *
 * @param request - Remix request object
 * @param params - URL parameters (id: activity ID)
 * @returns JSON response with updated activity
 *
 * Path Parameters:
 * - id: Activity ID (UUID)
 *
 * Request Body (all fields optional):
 * {
 *   developerId?: string (UUID) | null,
 *   accountId?: string (UUID) | null,
 *   anonId?: string | null,
 *   resourceId?: string (UUID) | null,
 *   action?: string,
 *   occurredAt?: string (ISO 8601 date),
 *   source?: string,
 *   sourceRef?: string | null,
 *   category?: string | null,
 *   groupKey?: string | null,
 *   metadata?: Record<string, any> | null,
 *   confidence?: number (0.0-1.0)
 * }
 *
 * Response:
 * 200 OK: Updated activity object
 * 400 Bad Request: Invalid request body, activity ID, or no update fields provided
 * 401 Unauthorized: Missing or invalid authentication
 * 404 Not Found: Activity not found
 * 500 Internal Server Error: Database error
 *
 * Important: Activities are event logs. Updates should be RARE:
 * - Developer ID resolution (anonymous → identified)
 * - Metadata enrichment
 * - Data correction errors
 */
export async function handleUpdateActivity({ request, params }: ActionFunctionArgs) {
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

    // 2. Extract and validate activity ID from URL params
    const activityId = params['id'];
    if (!activityId) {
      return json({ error: 'Activity ID is required' }, { status: 400 });
    }

    // 3. Validate UUID format
    try {
      UuidSchema.parse(activityId);
    } catch (error) {
      return json({ error: 'Invalid activity ID format' }, { status: 400 });
    }

    // 4. Parse request body (JSON)
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    // 5. Guard: Verify body is a non-null plain object
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return json({ error: 'Invalid request body' }, { status: 400 });
    }

    // 6. Convert occurredAt string to Date object if present
    // The service layer expects Date objects, not ISO 8601 strings
    if (body.occurredAt !== undefined && body.occurredAt !== null) {
      // Validate occurredAt is a string
      if (typeof body.occurredAt !== 'string') {
        return json({ error: 'Invalid occurredAt format' }, { status: 400 });
      }

      // Validate occurredAt is a valid date string
      const timestamp = Date.parse(body.occurredAt);
      if (isNaN(timestamp)) {
        return json({ error: 'Invalid occurredAt' }, { status: 400 });
      }

      // Safe to convert now
      body.occurredAt = new Date(body.occurredAt);
    }

    // 7. Build input for service layer (type assertion will be validated by service)
    const serviceInput: UpdateActivityInput = body;

    // 8. Call service layer to update activity
    // Service layer will validate input using Zod schema
    // Service layer will also check if activity exists and throw if not found
    const result = await updateActivity(tenantId, activityId, serviceInput);

    // 9. Return JSON response with 200 OK
    return json(result, { status: 200 });
  } catch (error) {
    // Handle "Activity not found" error from service layer
    if (error instanceof Error && error.message === 'Activity not found') {
      return json({ error: 'Activity not found' }, { status: 404 });
    }

    // Handle "No update fields provided" error from service layer
    if (error instanceof Error && error.message === 'No update fields provided') {
      return json({ error: 'No update fields provided' }, { status: 400 });
    }

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      const zodError = error as ZodError<Record<string, unknown>>;
      return json(
        {
          error: 'Validation failed',
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
    console.error('Failed to update activity:', error);
    return json({ error: 'Failed to update activity' }, { status: 500 });
  }
}
