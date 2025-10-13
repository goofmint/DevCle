/**
 * Developer API - Single Resource Route
 *
 * Handles operations on a single developer by ID.
 *
 * Endpoints:
 * - GET    /api/developers/:id - Get developer by ID
 * - PUT    /api/developers/:id - Update developer
 * - DELETE /api/developers/:id - Delete developer
 */

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { setTenantContext, clearTenantContext } from '../../../db/connection.js';
import {
  getDeveloper,
  updateDeveloper,
  deleteDeveloper,
  type UpdateDeveloperInput,
} from '../../../services/drm.service.js';
import { z } from 'zod';

/**
 * UUID validation schema
 * Used to validate developer ID format before processing
 */
const UuidSchema = z.string().uuid();

/**
 * GET /api/developers/:id - Get developer by ID
 *
 * Path Parameters:
 * - id: Developer ID (UUID)
 *
 * Response:
 * 200 OK
 * {
 *   developerId: "...",
 *   displayName: "...",
 *   ...
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid developer ID format
 * - 401 Unauthorized: Missing or invalid authentication
 * - 404 Not Found: Developer not found
 * - 500 Internal Server Error: Database error
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check using requireAuth middleware
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Extract developer ID from URL params
    const developerId = params['id'];

    // Validate that ID was provided in URL
    if (!developerId) {
      return json(
        { error: 'Developer ID is required' },
        { status: 400 }
      );
    }

    // 3. Validate developer ID format (must be valid UUID)
    try {
      UuidSchema.parse(developerId);
    } catch (validationError) {
      return json(
        { error: 'Invalid developer ID format' },
        { status: 400 }
      );
    }

    // 4. Set tenant context for RLS
    await setTenantContext(tenantId);

    try {
      // 5. Call service layer to get developer
      const result = await getDeveloper(tenantId, developerId);

      // 6. Clear tenant context after successful operation
      await clearTenantContext();

      // 7. If developer not found, return 404
      if (!result) {
        return json({ error: 'Developer not found' }, { status: 404 });
      }

      // 8. Return success response with developer data
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
      console.error('Failed to get developer:', error);
      return json({ error: 'Failed to retrieve developer' }, { status: 500 });
    }

    // Handle unexpected errors
    console.error('Unexpected error in GET /api/developers/:id:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/developers/:id - Update developer
 * DELETE /api/developers/:id - Delete developer
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
 * Handle PUT request - Update developer
 *
 * Path Parameters:
 * - id: Developer ID (UUID)
 *
 * Request Body (all fields optional):
 * {
 *   displayName?: string,
 *   primaryEmail?: string | null,
 *   orgId?: string (UUID) | null,
 *   consentAnalytics?: boolean,
 *   tags?: string[]
 * }
 *
 * Response:
 * 200 OK
 * {
 *   developerId: "...",
 *   displayName: "...",
 *   ...
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid request body or developer ID
 * - 401 Unauthorized: Missing or invalid authentication
 * - 404 Not Found: Developer not found
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

    // 2. Extract developer ID from URL params
    const developerId = params['id'];

    // Validate that ID was provided in URL
    if (!developerId) {
      return json(
        { error: 'Developer ID is required' },
        { status: 400 }
      );
    }

    // 3. Validate developer ID format (must be valid UUID)
    try {
      UuidSchema.parse(developerId);
    } catch (validationError) {
      return json(
        { error: 'Invalid developer ID format' },
        { status: 400 }
      );
    }

    // 4. Parse and validate request body
    let requestData: UpdateDeveloperInput;
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
      // 6. Call service layer to update developer
      // Service layer will validate input using Zod schema
      const result = await updateDeveloper(tenantId, developerId, requestData);

      // 7. Clear tenant context after successful operation
      await clearTenantContext();

      // 8. If developer not found, return 404
      if (!result) {
        return json({ error: 'Developer not found' }, { status: 404 });
      }

      // 9. Return success response with updated developer data
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

      // Duplicate email constraint violation (409 Conflict)
      if (error.message.includes('already exists')) {
        return json(
          { error: 'Developer with this email already exists' },
          { status: 409 }
        );
      }

      // Foreign key constraint violation (400 Bad Request)
      if (error.message.includes('does not exist')) {
        return json(
          { error: 'Referenced organization does not exist' },
          { status: 400 }
        );
      }

      // Log detailed error for debugging
      console.error('Failed to update developer:', error);

      // Return generic error message to client
      return json({ error: 'Failed to update developer' }, { status: 500 });
    }

    // Handle unexpected errors
    console.error('Unexpected error in PUT /api/developers/:id:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Handle DELETE request - Delete developer
 *
 * Path Parameters:
 * - id: Developer ID (UUID)
 *
 * Response:
 * 204 No Content (on success, no response body)
 *
 * Error Responses:
 * - 400 Bad Request: Invalid developer ID format
 * - 401 Unauthorized: Missing or invalid authentication
 * - 404 Not Found: Developer not found
 * - 500 Internal Server Error: Database error
 *
 * Note: This is a HARD DELETE. Consider soft delete for GDPR compliance.
 */
async function handleDelete(
  params: LoaderFunctionArgs['params'],
  request: Request
) {
  try {
    // 1. Authentication check
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Extract developer ID from URL params
    const developerId = params['id'];

    // Validate that ID was provided in URL
    if (!developerId) {
      return json(
        { error: 'Developer ID is required' },
        { status: 400 }
      );
    }

    // 3. Validate developer ID format (must be valid UUID)
    try {
      UuidSchema.parse(developerId);
    } catch (validationError) {
      return json(
        { error: 'Invalid developer ID format' },
        { status: 400 }
      );
    }

    // 4. Set tenant context for RLS
    await setTenantContext(tenantId);

    try {
      // 5. Call service layer to delete developer
      const success = await deleteDeveloper(tenantId, developerId);

      // 6. Clear tenant context after successful operation
      await clearTenantContext();

      // 7. If developer not found, return 404
      if (!success) {
        return json({ error: 'Developer not found' }, { status: 404 });
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
      console.error('Failed to delete developer:', error);
      return json({ error: 'Failed to delete developer' }, { status: 500 });
    }

    // Handle unexpected errors
    console.error('Unexpected error in DELETE /api/developers/:id:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
