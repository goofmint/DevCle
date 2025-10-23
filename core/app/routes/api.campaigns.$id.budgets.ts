/**
 * Campaign Budgets API - Budget List Route
 *
 * Handles retrieval of budget entries for a specific campaign.
 * Supports pagination and filtering by category.
 *
 * Endpoints:
 * - GET /api/campaigns/:id/budgets - Get campaign budgets with pagination
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { getCampaign } from '../../services/campaign.service.js';
import { getBudgets } from '../../services/campaign-detail.service.js';
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
 * GET /api/campaigns/:id/budgets - Get budgets for campaign
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
 *   budgets: [
 *     {
 *       budgetId: "...",
 *       tenantId: "...",
 *       campaignId: "...",
 *       category: "labor",
 *       amount: "10000.00",
 *       currency: "JPY",
 *       spentAt: "2025-03-01",
 *       source: "form",
 *       memo: "Staff costs",
 *       meta: {...},
 *       createdAt: "..."
 *     },
 *     ...
 *   ],
 *   total: 15
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
    // rather than returning an empty budget list
    const campaign = await getCampaign(tenantId, campaignId);
    if (!campaign) {
      return json({ error: 'Campaign not found' }, { status: 404 });
    }

    // 5. Parse and validate query parameters
    const url = new URL(request.url);
    const rawParams = {
      limit: url.searchParams.get('limit') ?? undefined,
      offset: url.searchParams.get('offset') ?? undefined,
      category: url.searchParams.get('category') ?? undefined,
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

    // 6. Call service to get budgets
    const result = await getBudgets(tenantId, campaignId, queryParams);

    // 7. Return success response with budget data
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
      console.error('Failed to get budgets:', error);

      // Return generic error message to client
      return json({ error: 'Failed to retrieve budgets' }, { status: 500 });
    }

    // Handle unexpected errors
    console.error('Unexpected error in GET /api/campaigns/:id/budgets:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
