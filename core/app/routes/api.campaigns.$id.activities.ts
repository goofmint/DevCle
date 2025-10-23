/**
 * Campaign Activities API - Activity List Route
 *
 * Handles retrieval of activity entries for a specific campaign.
 * Activities are developer actions (click, attend, post, etc.) linked via
 * activity_campaigns junction table for multi-touch attribution.
 * Supports pagination and filtering by action type.
 *
 * Endpoints:
 * - GET /api/campaigns/:id/activities - Get campaign activities with pagination
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { getCampaign } from '../../services/campaign.service.js';
import { getActivities } from '../../services/campaign-detail.service.js';
import { z } from 'zod';

/**
 * UUID validation schema
 * Used to validate campaign ID format before processing
 */
const UuidSchema = z.string().uuid();

/**
 * Query parameters validation schema
 * Used to validate and sanitize pagination and filter parameters
 */
const QueryParamsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  action: z.string().optional(),
});

/**
 * GET /api/campaigns/:id/activities - Get activities for campaign
 *
 * Path Parameters:
 * - id: Campaign ID (UUID)
 *
 * Query Parameters:
 * - limit: Number of records to return (max 100, default 50)
 * - offset: Number of records to skip (default 0)
 * - action: Filter by action type (optional)
 *
 * Response:
 * 200 OK
 * {
 *   activities: [
 *     {
 *       activityId: "...",
 *       tenantId: "...",
 *       developerId: "..." | null,
 *       accountId: "..." | null,
 *       anonId: "..." | null,
 *       resourceId: "..." | null,
 *       action: "attend",
 *       occurredAt: "...",
 *       recordedAt: "...",
 *       source: "connpass",
 *       sourceRef: "https://connpass.com/event/12345",
 *       category: "event",
 *       groupKey: "devrel-2025",
 *       metadata: {...},
 *       confidence: "1.0",
 *       value: "5000.00",
 *       dedupKey: "...",
 *       ingestedAt: "..."
 *     },
 *     ...
 *   ],
 *   total: 120
 * }
 *
 * Note:
 * - Activities are linked to campaigns via activity_campaigns junction table
 * - One activity can be attributed to multiple campaigns (multi-touch attribution)
 * - The JOIN query returns activities with at least one link to the specified campaign
 *
 * Error Responses:
 * - 400 Bad Request: Invalid campaign ID format or query parameters
 * - 401 Unauthorized: Missing or invalid authentication
 * - 404 Not Found: Campaign not found
 * - 500 Internal Server Error: Database error
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check using requireAuth middleware
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Extract campaign ID from URL params
    const campaignId = params['id'];

    // Validate that ID was provided in URL
    if (!campaignId) {
      return json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    // 3. Validate campaign ID format (must be valid UUID)
    try {
      UuidSchema.parse(campaignId);
    } catch (validationError) {
      return json({ error: 'Invalid campaign ID format' }, { status: 400 });
    }

    // 4. Verify campaign exists
    // This ensures we return 404 for non-existent campaigns
    // rather than returning an empty activity list
    const campaign = await getCampaign(tenantId, campaignId);
    if (!campaign) {
      return json({ error: 'Campaign not found' }, { status: 404 });
    }

    // 5. Parse and validate query parameters
    const url = new URL(request.url);
    const rawParams = {
      limit: url.searchParams.get('limit') ?? undefined,
      offset: url.searchParams.get('offset') ?? undefined,
      action: url.searchParams.get('action') ?? undefined,
    };

    // Validate query parameters using Zod schema
    let queryParams;
    try {
      queryParams = QueryParamsSchema.parse(rawParams);
    } catch (validationError) {
      return json(
        {
          error: 'Invalid query parameters',
          details:
            validationError instanceof z.ZodError
              ? validationError.flatten().fieldErrors
              : undefined,
        },
        { status: 400 }
      );
    }

    // 6. Call service to get activities
    const result = await getActivities(tenantId, campaignId, queryParams);

    // 7. Return success response with activity data
    return json(result, { status: 200 });
  } catch (error) {
    // Handle errors and return appropriate HTTP status codes

    // Handle requireAuth() redirect
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle service layer errors
    if (error instanceof Error) {
      // Log detailed error for debugging
      console.error('Failed to get activities:', error);

      // Return generic error message to client
      return json({ error: 'Failed to retrieve activities' }, { status: 500 });
    }

    // Handle unexpected errors
    console.error('Unexpected error in GET /api/campaigns/:id/activities:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
