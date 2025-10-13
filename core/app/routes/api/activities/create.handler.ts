/**
 * Activity API - Create Handler
 *
 * Handles POST /api/activities endpoint for creating activities.
 * Supports deduplication via dedupKey.
 */

import { json, type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '../../../auth.middleware.js';
import { createActivity, type CreateActivityInput } from '../../../../services/activity.service.js';
import { z, type ZodError } from 'zod';

/**
 * Handle POST /api/activities
 *
 * @param request - Remix request object
 * @returns JSON response with created activity
 *
 * Request Body:
 * {
 *   developerId?: string (UUID) | null,
 *   accountId?: string (UUID) | null,
 *   anonId?: string | null,
 *   resourceId?: string (UUID) | null,
 *   action: string,
 *   occurredAt: string (ISO 8601 date),
 *   source: string,
 *   sourceRef?: string | null,
 *   category?: string | null,
 *   groupKey?: string | null,
 *   metadata?: Record<string, any> | null,
 *   confidence?: number (0.0-1.0),
 *   dedupKey?: string | null
 * }
 *
 * Response:
 * 201 Created: Created activity object
 * 400 Bad Request: Invalid request body or missing required ID
 * 401 Unauthorized: Missing or invalid authentication
 * 409 Conflict: Duplicate dedupKey
 * 500 Internal Server Error: Database error
 */
export async function handleCreateActivity({ request }: ActionFunctionArgs) {
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

    // 2. Parse request body (JSON)
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    // 3. Convert occurredAt string to Date object if present
    // The service layer expects Date objects, not ISO 8601 strings
    if (body.occurredAt && typeof body.occurredAt === 'string') {
      body.occurredAt = new Date(body.occurredAt);
    }

    // 4. Build input for service layer (type assertion will be validated by service)
    const serviceInput: CreateActivityInput = body;

    // 5. Call service layer to create activity
    // Service layer will validate input using Zod schema
    const result = await createActivity(tenantId, serviceInput);

    // 6. Return JSON response with 201 Created
    return json(result, { status: 201 });
  } catch (error) {
    // Handle validation errors from service layer
    if (error instanceof Error && error.message.includes('At least one ID')) {
      return json({ error: error.message }, { status: 400 });
    }

    // Handle duplicate dedupKey error from service layer
    if (error instanceof Error && error.message.includes('Duplicate activity detected')) {
      return json(
        { error: 'Duplicate activity detected (dedupKey already exists)' },
        { status: 409 }
      );
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
    console.error('Failed to create activity:', error);
    return json({ error: 'Failed to create activity' }, { status: 500 });
  }
}
