/**
 * Developer Stats API - Get activity statistics for a developer
 *
 * Endpoint: GET /api/developers/:id/stats
 *
 * Returns activity statistics grouped by funnel stages:
 * - Awareness: click, view, visit
 * - Engagement: attend, post, comment, star, follow
 * - Adoption: signup, login, api_call
 * - Advocacy: share, speak, blog, contribute
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { getDeveloperStats } from '../../services/developer-stats.service.js';
import { z } from 'zod';

/**
 * UUID validation schema
 */
const UuidSchema = z.string().uuid();

/**
 * GET /api/developers/:id/stats
 *
 * Path Parameters:
 * - id: Developer ID (UUID)
 *
 * Response:
 * 200 OK
 * {
 *   stats: {
 *     totalActivities: 100,
 *     awarenessCount: 30,
 *     engagementCount: 40,
 *     adoptionCount: 20,
 *     advocacyCount: 10
 *   }
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid developer ID format
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

    // 4. Fetch activity statistics using service layer
    const stats = await getDeveloperStats(tenantId, developerId);

    // 5. Return statistics
    return json({ stats }, { status: 200 });
  } catch (error) {
    // 6. Handle errors

    // Handle requireAuth() redirect
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle service layer errors
    if (error instanceof Error) {
      console.error('Failed to get activity stats:', error);
      return json(
        { error: 'Failed to retrieve activity statistics' },
        { status: 500 }
      );
    }

    // Handle unexpected errors
    console.error('Unexpected error in GET /api/developers/:id/stats:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
