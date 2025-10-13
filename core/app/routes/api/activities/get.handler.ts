/**
 * Activity API - Get Handler
 *
 * Handles GET /api/activities/:id endpoint for retrieving a single activity.
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '../../../auth.middleware.js';
import { getActivity } from '../../../../services/activity.service.js';
import { z } from 'zod';

/**
 * UUID validation schema
 */
const UuidSchema = z.string().uuid();

/**
 * Handle GET /api/activities/:id
 *
 * @param request - Remix request object
 * @param params - URL parameters (id: activity ID)
 * @returns JSON response with activity details
 *
 * Path Parameters:
 * - id: Activity ID (UUID)
 *
 * Response:
 * 200 OK: Activity object
 * 400 Bad Request: Invalid activity ID format
 * 401 Unauthorized: Missing or invalid authentication
 * 404 Not Found: Activity not found
 * 500 Internal Server Error: Database error
 */
export async function handleGetActivity({ request, params }: LoaderFunctionArgs) {
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

    // 4. Call service layer to fetch activity
    const result = await getActivity(tenantId, activityId);

    // 5. If activity not found, return 404
    if (!result) {
      return json({ error: 'Activity not found' }, { status: 404 });
    }

    // 6. Return JSON response with 200 OK
    return json(result, { status: 200 });
  } catch (error) {
    // Handle other errors
    console.error('Failed to get activity:', error);
    return json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
