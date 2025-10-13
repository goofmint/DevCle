/**
 * Developer API - Resource Route
 *
 * Provides RESTful API for developer management.
 * Uses DRM Service (Task 4.1) for business logic.
 *
 * Architecture:
 * - HTTP Request -> Resource Route (this file) -> DRM Service -> Drizzle ORM -> PostgreSQL
 * - Handles HTTP-specific concerns (request/response, status codes, error handling)
 * - Delegates business logic to DRM Service
 * - Enforces tenant context via RLS
 *
 * Endpoints:
 * - GET    /api/developers       - List developers (with pagination, filtering, sorting)
 * - POST   /api/developers       - Create a new developer
 */

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { setTenantContext, clearTenantContext } from '../../../db/connection.js';
import {
  createDeveloper,
  listDevelopers,
  type CreateDeveloperInput,
  type ListDevelopersInput,
} from '../../../services/drm.service.js';
import { z } from 'zod';

/**
 * GET /api/developers - List developers
 *
 * Query Parameters:
 * - limit: Number of records to return (max 100, default 50)
 * - offset: Number of records to skip (default 0)
 * - orgId: Filter by organization ID (optional)
 * - search: Search in display_name and primary_email (optional)
 * - orderBy: Field to sort by ('displayName', 'primaryEmail', 'createdAt', 'updatedAt', default: 'createdAt')
 * - orderDirection: Sort direction ('asc', 'desc', default: 'desc')
 *
 * Response:
 * 200 OK
 * {
 *   developers: [...],
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
    // This throws a redirect to /auth/login if not authenticated
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
      orgId: url.searchParams.get('orgId') || undefined,
      search: url.searchParams.get('search') || undefined,
      orderBy: url.searchParams.get('orderBy') || undefined,
      orderDirection: url.searchParams.get('orderDirection') || undefined,
    };

    // 3. Set tenant context for RLS (Row Level Security)
    // This ensures all database queries are filtered by tenant_id
    await setTenantContext(tenantId);

    try {
      // 4. Call service layer to list developers
      // Service layer will validate params using Zod schema and apply defaults
      const result = await listDevelopers(tenantId, rawParams as ListDevelopersInput);

      // 5. Clear tenant context after successful operation
      await clearTenantContext();

      // 6. Return success response with developers list
      return json(result, { status: 200 });
    } catch (serviceError) {
      // Ensure tenant context is cleared even if service call fails
      await clearTenantContext();
      throw serviceError; // Re-throw to outer catch block
    }
  } catch (error) {
    // 7. Handle errors and return appropriate HTTP status codes

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
      console.error('Failed to list developers:', error);

      // Return generic error message to client (don't expose internal details)
      return json({ error: 'Failed to fetch developers' }, { status: 500 });
    }

    // Handle unexpected errors (shouldn't happen, but just in case)
    console.error('Unexpected error in GET /api/developers:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/developers - Create a new developer
 *
 * Request Body:
 * {
 *   displayName: string,
 *   primaryEmail: string | null,
 *   orgId: string (UUID) | null,
 *   consentAnalytics?: boolean,
 *   tags?: string[]
 * }
 *
 * Response:
 * 201 Created
 * {
 *   developerId: "...",
 *   displayName: "...",
 *   ...
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid request body (validation error)
 * - 401 Unauthorized: Missing or invalid authentication
 * - 409 Conflict: Developer with this email already exists
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
    let requestData: CreateDeveloperInput;
    try {
      requestData = await request.json();
    } catch (parseError) {
      // Handle JSON parsing errors
      return json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // 3. Set tenant context for RLS
    await setTenantContext(tenantId);

    try {
      // 4. Call service layer to create developer
      // Service layer will validate input using Zod schema
      const result = await createDeveloper(tenantId, requestData);

      // 5. Clear tenant context after successful operation
      await clearTenantContext();

      // 6. Return success response with 201 Created status
      return json(result, { status: 201 });
    } catch (serviceError) {
      // Ensure tenant context is cleared even if service call fails
      await clearTenantContext();
      throw serviceError; // Re-throw to outer catch block
    }
  } catch (error) {
    // 7. Handle errors and return appropriate HTTP status codes

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
      console.error('Failed to create developer:', error);

      // Return generic error message to client
      return json({ error: 'Failed to create developer' }, { status: 500 });
    }

    // Handle unexpected errors
    console.error('Unexpected error in POST /api/developers:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
