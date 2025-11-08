/**
 * API Tokens API - Resource Route
 *
 * Provides RESTful API for API token management (Task 8.16-8.20).
 * Uses Token Service for business logic.
 *
 * Architecture:
 * - HTTP Request -> Resource Route (this file) -> Token Service -> Drizzle ORM -> PostgreSQL
 * - Handles HTTP-specific concerns (request/response, status codes, error handling)
 * - Delegates business logic to Token Service
 * - Enforces tenant context via RLS
 *
 * Endpoints (Task 8.16):
 * - GET    /api/tokens       - List API tokens (with pagination and status filtering)
 *
 * Future endpoints (Task 8.17):
 * - POST   /api/tokens       - Create a new API token
 */

import {
  json,
  type LoaderFunctionArgs,
} from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import {
  listTokens,
  type ListTokensInput,
} from '../../services/token.service.js';
import { z } from 'zod';

/**
 * GET /api/tokens - List API tokens
 *
 * Query Parameters:
 * - page: Page number (default 1)
 * - perPage: Number of records per page (max 100, default 20)
 * - status: Filter by token status ('active', 'expired', 'revoked', 'all', default: 'active')
 *
 * Response:
 * 200 OK
 * {
 *   items: [{
 *     tokenId: "...",
 *     tenantId: "...",
 *     name: "...",
 *     tokenPrefix: "drowltok_ABCDEFG",
 *     scopes: ["webhook:write"],
 *     lastUsedAt: "2025-01-01T00:00:00Z" | null,
 *     expiresAt: "2025-12-31T23:59:59Z" | null,
 *     createdBy: "...",
 *     createdAt: "2025-01-01T00:00:00Z",
 *     revokedAt: null,
 *     status: "active" | "expired" | "revoked"
 *   }],
 *   total: 123,
 *   page: 1,
 *   perPage: 20
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid query parameters
 * - 401 Unauthorized: Missing or invalid authentication
 * - 500 Internal Server Error: Database error
 *
 * Security:
 * - Never returns plain text tokens (only token_prefix for display)
 * - RLS ensures tenant isolation
 * - Status is computed based on current timestamp
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
      page: url.searchParams.get('page')
        ? Number(url.searchParams.get('page'))
        : undefined,
      perPage: url.searchParams.get('perPage')
        ? Number(url.searchParams.get('perPage'))
        : undefined,
      status: url.searchParams.get('status') || undefined,
    };

    // 3. Call service layer to list tokens (tenant isolation handled inside)
    const result = await listTokens(
      tenantId,
      rawParams as ListTokensInput
    );

    // 4. Return success response with tokens list
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
      console.error('Failed to list API tokens:', error);

      // Return generic error message to client (don't expose internal details)
      return json({ error: 'Failed to fetch API tokens' }, { status: 500 });
    }

    // Handle unexpected errors (shouldn't happen, but just in case)
    console.error('Unexpected error in GET /api/tokens:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
