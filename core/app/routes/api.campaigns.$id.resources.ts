/**
 * Campaign Resources API - Resource List Route
 *
 * Handles retrieval of resource entries for a specific campaign.
 * Resources are trackable objects like events, blogs, videos, ads, etc.
 * Supports pagination and filtering by category.
 *
 * Endpoints:
 * - GET /api/campaigns/:id/resources - Get campaign resources with pagination
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { getCampaign } from '../../services/campaign.service.js';
import { getResources } from '../../services/campaign-detail.service.js';
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
  category: z.string().optional(),
});

/**
 * GET /api/campaigns/:id/resources - Get resources for campaign
 *
 * Path Parameters:
 * - id: Campaign ID (UUID)
 *
 * Query Parameters:
 * - limit: Number of records to return (max 100, default 50)
 * - offset: Number of records to skip (default 0)
 * - category: Filter by category (optional)
 *
 * Response:
 * 200 OK
 * {
 *   resources: [
 *     {
 *       resourceId: "...",
 *       tenantId: "...",
 *       category: "event",
 *       groupKey: "devrel-2025",
 *       title: "DevRel Conference 2025",
 *       url: "https://example.com/events/2025",
 *       externalId: "connpass-12345",
 *       campaignId: "...",
 *       attributes: {...},
 *       createdAt: "...",
 *       updatedAt: "..."
 *     },
 *     ...
 *   ],
 *   total: 8
 * }
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
    // rather than returning an empty resource list
    const campaign = await getCampaign(tenantId, campaignId);
    if (!campaign) {
      return json({ error: 'Campaign not found' }, { status: 404 });
    }

    // 5. Parse and validate query parameters
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');
    const categoryParam = url.searchParams.get('category');

    const rawParams = {
      ...(limitParam !== null && { limit: limitParam }),
      ...(offsetParam !== null && { offset: offsetParam }),
      ...(categoryParam !== null && { category: categoryParam }),
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

    // 6. Call service to get resources
    const result = await getResources(tenantId, campaignId, queryParams);

    // 7. Return success response with resource data
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
      console.error('Failed to get resources:', error);

      // Return generic error message to client
      return json({ error: 'Failed to retrieve resources' }, { status: 500 });
    }

    // Handle unexpected errors
    console.error('Unexpected error in GET /api/campaigns/:id/resources:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
