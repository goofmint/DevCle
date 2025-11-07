/**
 * Activities API - Create activity
 *
 * Endpoint: POST /api/activities
 *
 * Creates a new activity record.
 * This endpoint is designed for plugin handlers to record activities via internal API calls.
 *
 * Authentication: Plugin token (Bearer token via Authorization header)
 */

import { json, type ActionFunctionArgs } from '@remix-run/node';
import { requirePluginAuth } from '~/auth.middleware.js';
import { createActivity } from '../../services/activity-create.service.js';
import { CreateActivitySchema } from '../../services/activity.schemas.js';
import { ZodError } from 'zod';

/**
 * POST /api/activities
 *
 * Request Body:
 * {
 *   developerId?: string (UUID),
 *   accountId?: string (UUID),
 *   anonId?: string,
 *   resourceId?: string (UUID),
 *   action: string (required),
 *   occurredAt: string|Date (required),
 *   source: string (required),
 *   sourceRef?: string,
 *   category?: string,
 *   groupKey?: string,
 *   metadata?: Record<string, any>,
 *   confidence?: number,
 *   value?: number,
 *   dedupKey?: string
 * }
 *
 * Response:
 * 201 Created
 * {
 *   activityId: "uuid",
 *   developerId: "uuid" | null,
 *   accountId: "uuid" | null,
 *   anonId: string | null,
 *   action: "click",
 *   source: "plugin:example",
 *   occurredAt: "2025-01-01T00:00:00Z",
 *   metadata: {...}
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid request body or validation error
 * - 401 Unauthorized: Missing or invalid plugin token
 * - 500 Internal Server Error: Database error
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    // 1. Authenticate plugin request
    const pluginAuth = await requirePluginAuth(request);
    const tenantId = pluginAuth.tenantId;

    // 2. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch (parseError) {
      return json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // 3. Validate activity data using schema
    let activityData;
    try {
      activityData = CreateActivitySchema.parse(body);
    } catch (validationError) {
      if (validationError instanceof ZodError) {
        return json(
          {
            error: 'Validation failed',
            details: validationError.errors,
          },
          { status: 400 }
        );
      }
      throw validationError;
    }

    // 4. Create activity
    const activity = await createActivity(tenantId, activityData);

    // 5. Return created activity
    return json(activity, { status: 201 });
  } catch (error) {
    // Handle authentication errors (thrown as Response objects)
    if (error instanceof Response) {
      return error;
    }

    // Handle other errors
    console.error('[POST /api/activities] Error:', error);
    return json(
      {
        error: 'Failed to create activity',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
