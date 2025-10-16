/**
 * Campaign API - Single Resource Route
 *
 * Handles operations on a single campaign by ID.
 *
 * Endpoints:
 * - GET    /api/campaigns/:id - Get campaign by ID
 * - PUT    /api/campaigns/:id - Update campaign
 * - DELETE /api/campaigns/:id - Delete campaign
 */

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { setTenantContext, clearTenantContext } from '../../../db/connection.js';
import {
  getCampaign,
  updateCampaign,
  deleteCampaign,
  type UpdateCampaignInput,
} from '../../../services/campaign.service.js';
import { z } from 'zod';

/**
 * UUID validation schema
 * Used to validate campaign ID format before processing
 */
const UuidSchema = z.string().uuid();

/**
 * GET /api/campaigns/:id - Get campaign by ID
 *
 * Path Parameters:
 * - id: Campaign ID (UUID)
 *
 * Response:
 * 200 OK
 * {
 *   campaignId: "...",
 *   tenantId: "...",
 *   name: "...",
 *   ...
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid campaign ID format
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

    // 4. Set tenant context for RLS
    await setTenantContext(tenantId);

    try {
      // 5. Call service layer to get campaign
      const result = await getCampaign(tenantId, campaignId);

      // 6. Clear tenant context after successful operation
      await clearTenantContext();

      // 7. If campaign not found, return 404
      if (!result) {
        return json({ error: 'Campaign not found' }, { status: 404 });
      }

      // 8. Return success response with campaign data
      return json(result, { status: 200 });
    } catch (serviceError) {
      // Ensure tenant context is cleared even if service call fails
      await clearTenantContext();
      throw serviceError; // Re-throw to outer catch block
    }
  } catch (error) {
    // 9. Handle errors and return appropriate HTTP status codes

    // Handle requireAuth() redirect
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle service layer errors
    if (error instanceof Error) {
      console.error('Failed to get campaign:', error);
      return json({ error: 'Failed to retrieve campaign' }, { status: 500 });
    }

    // Handle unexpected errors
    console.error('Unexpected error in GET /api/campaigns/:id:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/campaigns/:id - Update campaign
 * DELETE /api/campaigns/:id - Delete campaign
 *
 * This action handler supports multiple HTTP methods on the same route.
 */
export async function action({ params, request }: ActionFunctionArgs) {
  const method = request.method;

  // Route to appropriate handler based on HTTP method
  if (method === 'PUT') {
    return handleUpdate(params, request);
  }

  if (method === 'DELETE') {
    return handleDelete(params, request);
  }

  // Method not allowed (only PUT and DELETE are supported)
  return json({ error: 'Method not allowed' }, { status: 405 });
}

/**
 * Handle PUT request - Update campaign
 *
 * Path Parameters:
 * - id: Campaign ID (UUID)
 *
 * Request Body (all fields optional):
 * {
 *   name?: string,
 *   channel?: string | null,
 *   startDate?: string (ISO 8601 date) | null,
 *   endDate?: string (ISO 8601 date) | null,
 *   budgetTotal?: string (decimal) | null,
 *   attributes?: { [key: string]: any }
 * }
 *
 * Response:
 * 200 OK
 * {
 *   campaignId: "...",
 *   tenantId: "...",
 *   name: "...",
 *   ...
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid request body or campaign ID
 * - 401 Unauthorized: Missing or invalid authentication
 * - 404 Not Found: Campaign not found
 * - 409 Conflict: Campaign with this name already exists
 * - 500 Internal Server Error: Database error
 */
async function handleUpdate(
  params: LoaderFunctionArgs['params'],
  request: Request
) {
  try {
    // 1. Authentication check
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

    // 4. Parse and validate request body
    let requestData: UpdateCampaignInput;
    try {
      requestData = await request.json();
    } catch (parseError) {
      return json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // 5. Set tenant context for RLS
    await setTenantContext(tenantId);

    try {
      // 6. Call service layer to update campaign
      // Service layer will validate input using Zod schema
      const result = await updateCampaign(tenantId, campaignId, requestData);

      // 7. Clear tenant context after successful operation
      await clearTenantContext();

      // 8. If campaign not found, return 404
      if (!result) {
        return json({ error: 'Campaign not found' }, { status: 404 });
      }

      // 9. Return success response with updated campaign data
      return json(result, { status: 200 });
    } catch (serviceError) {
      // Ensure tenant context is cleared even if service call fails
      await clearTenantContext();
      throw serviceError; // Re-throw to outer catch block
    }
  } catch (error) {
    // 10. Handle errors and return appropriate HTTP status codes

    // Handle requireAuth() redirect
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle Zod validation errors
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
      console.error('Failed to update campaign:', error);

      // Return generic error message to client
      return json({ error: 'Failed to update campaign' }, { status: 500 });
    }

    // Handle unexpected errors
    console.error('Unexpected error in PUT /api/campaigns/:id:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Handle DELETE request - Delete campaign
 *
 * Path Parameters:
 * - id: Campaign ID (UUID)
 *
 * Response:
 * 204 No Content (on success, no response body)
 *
 * Error Responses:
 * - 400 Bad Request: Invalid campaign ID format
 * - 401 Unauthorized: Missing or invalid authentication
 * - 404 Not Found: Campaign not found
 * - 500 Internal Server Error: Database error
 *
 * Note:
 * - Related budgets are CASCADE deleted (FK constraint)
 * - Related resources are orphaned (campaign_id = NULL)
 */
async function handleDelete(
  params: LoaderFunctionArgs['params'],
  request: Request
) {
  try {
    // 1. Authentication check
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

    // 4. Set tenant context for RLS
    await setTenantContext(tenantId);

    try {
      // 5. Call service layer to delete campaign
      const success = await deleteCampaign(tenantId, campaignId);

      // 6. Clear tenant context after successful operation
      await clearTenantContext();

      // 7. If campaign not found, return 404
      if (!success) {
        return json({ error: 'Campaign not found' }, { status: 404 });
      }

      // 8. Return 204 No Content (successful deletion with no response body)
      return new Response(null, { status: 204 });
    } catch (serviceError) {
      // Ensure tenant context is cleared even if service call fails
      await clearTenantContext();
      throw serviceError; // Re-throw to outer catch block
    }
  } catch (error) {
    // 9. Handle errors and return appropriate HTTP status codes

    // Handle requireAuth() redirect
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle service layer errors
    if (error instanceof Error) {
      console.error('Failed to delete campaign:', error);
      return json({ error: 'Failed to delete campaign' }, { status: 500 });
    }

    // Handle unexpected errors
    console.error('Unexpected error in DELETE /api/campaigns/:id:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
