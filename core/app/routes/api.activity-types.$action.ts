/**
 * Activity Type Individual Resource API Route
 *
 * Handles operations on individual activity types.
 *
 * Endpoints:
 * - GET /api/activity-types/:action - Get activity type by action
 * - PUT /api/activity-types/:action - Update activity type
 * - DELETE /api/activity-types/:action - Delete activity type
 *
 * Security:
 * - GET: Authenticated users
 * - PUT/DELETE: Admin-only
 * - Tenant-scoped via requireAuth()
 * - Input validation via Zod schemas
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import {
  getActivityTypeByAction,
  updateActivityType,
  deleteActivityType,
} from '../../services/activity-type.service.js';
import { UpdateActivityTypeSchema } from '../../services/activity-type.schemas.js';

/**
 * GET /api/activity-types/:action
 *
 * Get activity type by action
 *
 * Response:
 * {
 *   activityType: ActivityType
 * }
 *
 * Errors:
 * - 401: Unauthorized
 * - 404: Activity type not found
 * - 500: Internal server error
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    // Get action from params
    const { action } = params;
    if (!action) {
      return json({ error: 'Action parameter required' }, { status: 400 });
    }

    // Get activity type
    const activityType = await getActivityTypeByAction(user.tenantId, action);

    if (!activityType) {
      return json({ error: 'Activity type not found' }, { status: 404 });
    }

    return json({ activityType });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Failed to get activity type:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/activity-types/:action
 * DELETE /api/activity-types/:action
 *
 * Update or delete activity type
 *
 * PUT request body:
 * {
 *   iconName?: string,
 *   colorClass?: string,
 *   stageKey?: string | null
 * }
 *
 * Response:
 * {
 *   activityType: ActivityType (for PUT)
 * }
 *
 * Errors:
 * - 400: Invalid request body (PUT)
 * - 401: Unauthorized
 * - 403: Admin role required
 * - 404: Activity type not found
 * - 405: Method not allowed
 * - 500: Internal server error
 */
export async function action({ request, params }: ActionFunctionArgs) {
  try {
    // Get action from params
    const { action } = params;
    if (!action) {
      return json({ error: 'Action parameter required' }, { status: 400 });
    }

    // Require admin authentication
    const user = await requireAuth(request);

    if (user.role !== 'admin') {
      return json({ error: 'Forbidden' }, { status: 403 });
    }

    // Handle PUT
    if (request.method === 'PUT') {
      // Parse request body
      const body = await request.json();
      const data = UpdateActivityTypeSchema.parse(body);

      // Update activity type
      const activityType = await updateActivityType(user.tenantId, action, data);

      return json({ activityType });
    }

    // Handle DELETE
    if (request.method === 'DELETE') {
      // Delete activity type
      await deleteActivityType(user.tenantId, action);

      return json({ success: true }, { status: 200 });
    }

    return json({ error: 'Method not allowed' }, { status: 405 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'Admin role required') {
      return json({ error: 'Admin role required' }, { status: 403 });
    }

    // Zod validation error
    if (error instanceof Error && error.name === 'ZodError') {
      return json({ error: 'Invalid request body', details: error }, { status: 400 });
    }

    // Not found error
    if (error instanceof Error && error.message.includes('not found')) {
      return json({ error: 'Activity type not found' }, { status: 404 });
    }

    console.error('Failed to update/delete activity type:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
