/**
 * Activity API - Delete Handler
 *
 * Handles DELETE /api/activities/:id endpoint for deleting activities.
 * Deletion is EXTREMELY RARE - only for GDPR compliance or spam removal.
 */

import { json, type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '../../../auth.middleware.js';
import { deleteActivity } from '../../../../services/activity.service.js';
import { z } from 'zod';

/**
 * UUID validation schema
 */
const UuidSchema = z.string().uuid();

/**
 * Handle DELETE /api/activities/:id
 *
 * @param request - Remix request object
 * @param params - URL parameters (id: activity ID)
 * @returns 204 No Content on success, error response on failure
 *
 * Path Parameters:
 * - id: Activity ID (UUID)
 *
 * Response:
 * 204 No Content: Activity deleted successfully (no response body)
 * 400 Bad Request: Invalid activity ID format
 * 401 Unauthorized: Missing or invalid authentication
 * 404 Not Found: Activity not found
 * 500 Internal Server Error: Database error
 *
 * Important: Activities are event logs. Deletion should be EXTREMELY RARE:
 * - GDPR compliance (Right to be forgotten)
 * - Spam or test data removal
 * - Erroneous data that cannot be corrected
 *
 * Note: This is a HARD DELETE. Consider soft delete for audit trail.
 */
export async function handleDeleteActivity({ request, params }: ActionFunctionArgs) {
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

    // 4. Call service layer to delete activity
    // Service layer returns true if deleted, false if not found
    const result = await deleteActivity(tenantId, activityId);

    // 5. If activity not found, return 404
    if (!result) {
      return json({ error: 'Activity not found' }, { status: 404 });
    }

    // 6. Return 204 No Content (successful deletion, no response body)
    return new Response(null, { status: 204 });
  } catch (error) {
    // Handle other errors
    console.error('Failed to delete activity:', error);
    return json({ error: 'Failed to delete activity' }, { status: 500 });
  }
}
