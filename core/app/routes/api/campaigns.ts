/**
 * Campaign API - Resource Route
 *
 * Provides RESTful API for campaign management.
 * Uses Campaign Service (Task 5.1) for business logic.
 *
 * Architecture:
 * - HTTP Request -> Resource Route (this file) -> Campaign Service -> Drizzle ORM -> PostgreSQL
 * - Handles HTTP-specific concerns (request/response, status codes, error handling)
 * - Delegates business logic to Campaign Service
 * - Enforces tenant context via RLS
 *
 * Endpoints:
 * - GET    /api/campaigns       - List campaigns (with pagination, filtering, sorting)
 * - POST   /api/campaigns       - Create a new campaign
 */

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import {
  createCampaign,
  listCampaigns,
  type CreateCampaignInput,
  type ListCampaignsInput,
} from '../../../services/campaign.service.js';
import { z } from 'zod';

/**
 * GET /api/campaigns - List campaigns
 *
 * Query Parameters:
 * - limit: Number of records to return (max 100, default 50)
 * - offset: Number of records to skip (default 0)
 * - channel: Filter by channel (optional)
 * - search: Search in name (optional, partial match, case-insensitive)
 * - orderBy: Field to sort by ('name', 'startDate', 'endDate', 'createdAt', 'updatedAt', default: 'createdAt')
 * - orderDirection: Sort direction ('asc', 'desc', default: 'desc')
 *
 * Response:
 * 200 OK
 * {
 *   campaigns: [...],
 *   total: 123
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid query parameters
 * - 401 Unauthorized: Missing or invalid authentication
 * - 500 Internal Server Error: Database error
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check using requireAuth middleware
    // This throws a redirect to /login if not authenticated
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Parse query parameters from URL
    const url = new URL(request.url);
    const rawParams = {
      limit: url.searchParams.get('limit')
        ? Number(url.searchParams.get('limit'))
        : undefined,
      offset: url.searchParams.get('offset')
        ? Number(url.searchParams.get('offset'))
        : undefined,
      channel: url.searchParams.get('channel') || undefined,
      search: url.searchParams.get('search') || undefined,
      orderBy: url.searchParams.get('orderBy') || undefined,
      orderDirection: url.searchParams.get('orderDirection') || undefined,
    };

    // 3. Call service layer to list campaigns (tenant isolation handled inside)
    const result = await listCampaigns(
      tenantId,
      rawParams as ListCampaignsInput
    );

    // 4. Return success response with campaigns list
    return json(result, { status: 200 });
  } catch (error) {
    // Handle errors and return appropriate HTTP status codes

    // Handle requireAuth() redirect (API should return 401 instead of redirect)
    // requireAuth() throws a Response with status 302 when user is not authenticated
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle Zod validation errors (invalid query parameters)
    if (error instanceof z.ZodError) {
      return json(
        {
          error: 'Invalid query parameters',
          details: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Handle service layer errors (database errors, business logic errors)
    if (error instanceof Error) {
      // Log detailed error for debugging
      console.error('Failed to list campaigns:', error);

      // Return generic error message to client (don't expose internal details)
      return json({ error: 'Failed to fetch campaigns' }, { status: 500 });
    }

    // Handle unexpected errors (shouldn't happen, but just in case)
    console.error('Unexpected error in GET /api/campaigns:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/campaigns - Create a new campaign
 *
 * Request Body:
 * {
 *   name: string,
 *   channel: string | null,
 *   startDate: string (ISO 8601 date) | null,
 *   endDate: string (ISO 8601 date) | null,
 *   budgetTotal: string (decimal) | null,
 *   attributes: { [key: string]: any }
 * }
 *
 * Response:
 * 201 Created
 * {
 *   campaignId: "...",
 *   tenantId: "...",
 *   name: "...",
 *   ...
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid request body (validation error)
 * - 401 Unauthorized: Missing or invalid authentication
 * - 409 Conflict: Campaign with this name already exists
 * - 500 Internal Server Error: Database error
 */
export async function action({ request }: ActionFunctionArgs) {
  const method = request.method;

  // Only POST method is allowed in this route
  if (method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // 1. Authentication check using requireAuth middleware
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Parse and validate request body (JSON)
    let requestData: CreateCampaignInput;
    try {
      requestData = await request.json();
    } catch (parseError) {
      // Handle JSON parsing errors
      return json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // 3. Call service layer to create campaign (handles tenant scoping)
    const result = await createCampaign(tenantId, requestData);

    // 4. Return success response with 201 Created status
    return json(result, { status: 201 });
  } catch (error) {
    // Handle errors and return appropriate HTTP status codes

    // Handle requireAuth() redirect
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle Zod validation errors (invalid request body)
    if (error instanceof z.ZodError) {
      return json(
        {
          error: 'Validation failed',
          details: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Handle service layer errors
    if (error instanceof Error) {
      // Check for specific error messages from service layer

      // Duplicate campaign name constraint violation (409 Conflict)
      if (
        error.message.includes('already exists') ||
        error.message.includes('duplicate key')
      ) {
        return json(
          { error: 'Campaign with this name already exists' },
          { status: 409 }
        );
      }

      // Log detailed error for debugging
      console.error('Failed to create campaign:', error);

      // Return generic error message to client
      return json({ error: 'Failed to create campaign' }, { status: 500 });
    }

    // Handle unexpected errors
    console.error('Unexpected error in POST /api/campaigns:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
