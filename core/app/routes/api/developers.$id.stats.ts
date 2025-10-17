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
import { withTenantContext } from '../../../db/connection.js';
import * as schema from '../../../db/schema/index.js';
import { eq, and, inArray, count } from 'drizzle-orm';
import { z } from 'zod';

/**
 * UUID validation schema
 */
const UuidSchema = z.string().uuid();

/**
 * Funnel stage mapping
 * Maps activity actions to funnel stages
 */
const FUNNEL_STAGES = {
  awareness: ['click', 'view', 'visit'],
  engagement: ['attend', 'post', 'comment', 'star', 'follow'],
  adoption: ['signup', 'login', 'api_call'],
  advocacy: ['share', 'speak', 'blog', 'contribute'],
} as const;

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

    // 4. Fetch activity statistics using Drizzle ORM with tenant context
    const stats = await withTenantContext(tenantId, async (tx) => {
      try {
        // Query total activities count
        const totalResult = await tx
          .select({ count: count() })
          .from(schema.activities)
          .where(
            and(
              eq(schema.activities.tenantId, tenantId),
              eq(schema.activities.developerId, developerId)
            )
          );

        // Query counts for each funnel stage in parallel
        const [awarenessResult, engagementResult, adoptionResult, advocacyResult] = await Promise.all([
          // Awareness count
          tx
            .select({ count: count() })
            .from(schema.activities)
            .where(
              and(
                eq(schema.activities.tenantId, tenantId),
                eq(schema.activities.developerId, developerId),
                inArray(schema.activities.action, FUNNEL_STAGES.awareness)
              )
            ),
          // Engagement count
          tx
            .select({ count: count() })
            .from(schema.activities)
            .where(
              and(
                eq(schema.activities.tenantId, tenantId),
                eq(schema.activities.developerId, developerId),
                inArray(schema.activities.action, FUNNEL_STAGES.engagement)
              )
            ),
          // Adoption count
          tx
            .select({ count: count() })
            .from(schema.activities)
            .where(
              and(
                eq(schema.activities.tenantId, tenantId),
                eq(schema.activities.developerId, developerId),
                inArray(schema.activities.action, FUNNEL_STAGES.adoption)
              )
            ),
          // Advocacy count
          tx
            .select({ count: count() })
            .from(schema.activities)
            .where(
              and(
                eq(schema.activities.tenantId, tenantId),
                eq(schema.activities.developerId, developerId),
                inArray(schema.activities.action, FUNNEL_STAGES.advocacy)
              )
            ),
        ]);

        return {
          totalActivities: totalResult[0]?.count ?? 0,
          awarenessCount: awarenessResult[0]?.count ?? 0,
          engagementCount: engagementResult[0]?.count ?? 0,
          adoptionCount: adoptionResult[0]?.count ?? 0,
          advocacyCount: advocacyResult[0]?.count ?? 0,
        };
      } catch (error) {
        console.error('Failed to query activity stats:', error);
        throw new Error('Failed to retrieve activity statistics from database');
      }
    });

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
