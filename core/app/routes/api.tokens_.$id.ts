/**
 * API Token Detail API - Resource Route
 *
 * Provides RESTful API for managing individual API tokens (Tasks 8.18-8.19).
 * Uses Token Service for business logic.
 *
 * Architecture:
 * - HTTP Request -> Resource Route (this file) -> Token Service -> Drizzle ORM -> PostgreSQL
 * - Handles HTTP-specific concerns (request/response, status codes, error handling)
 * - Delegates business logic to Token Service
 * - Enforces tenant context via RLS
 *
 * Endpoints:
 * - GET    /api/tokens/:id  - Get API token detail by ID (Task 8.18)
 * - DELETE /api/tokens/:id  - Revoke API token (Task 8.19)
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { getToken, revokeToken } from '../../services/token.service.js';

/**
 * GET /api/tokens/:id - Get API token detail
 *
 * URL Parameters:
 * - id: Token ID (UUID format)
 *
 * Response:
 * 200 OK
 * {
 *   tokenId: "...",
 *   tenantId: "...",
 *   name: "...",
 *   tokenPrefix: "drowltok_ABCDEFG",  // First 16 chars for UI display
 *   scopes: ["webhook:write"],
 *   lastUsedAt: "2025-01-15T10:30:00Z" | null,
 *   expiresAt: "2025-12-31T23:59:59Z" | null,
 *   createdBy: "...",
 *   createdAt: "2025-01-01T00:00:00Z",
 *   revokedAt: null | "2025-01-20T15:00:00Z",
 *   status: "active" | "expired" | "revoked"
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Token ID is missing
 * - 401 Unauthorized: Missing or invalid authentication
 * - 404 Not Found: Token not found or belongs to different tenant
 * - 500 Internal Server Error: Database error
 *
 * Security:
 * - Never returns plain text token (only token_prefix for display)
 * - Never returns tokenHash (internal verification secret)
 * - RLS ensures tenant isolation
 * - Status is computed based on current timestamp
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check using requireAuth middleware
    // This throws a redirect to /login if not authenticated
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Validate URL parameter
    const tokenId = params['id'];
    if (!tokenId) {
      return json({ error: 'Token ID is required' }, { status: 400 });
    }

    // 3. Call service layer to get token (tenant isolation handled inside)
    const token = await getToken(tenantId, tokenId);

    // 4. Return success response with token detail
    return json(token, { status: 200 });
  } catch (error) {
    // Handle errors and return appropriate HTTP status codes

    // Handle requireAuth() redirect (API should return 401 instead of redirect)
    // requireAuth() throws a Response with status 302 when user is not authenticated
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle service layer errors (database errors, business logic errors)
    if (error instanceof Error) {
      // Special handling for "Token not found" error
      if (error.message === 'Token not found') {
        return json({ error: 'Token not found' }, { status: 404 });
      }

      // Log detailed error for debugging
      console.error('Failed to get API token:', error);

      // Return generic error message to client (don't expose internal details)
      return json({ error: 'Failed to fetch API token' }, { status: 500 });
    }

    // Handle unexpected errors (shouldn't happen, but just in case)
    console.error('Unexpected error in GET /api/tokens/:id:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/tokens/:id - Revoke API token (logical delete)
 *
 * URL Parameters:
 * - id: Token ID (UUID format)
 *
 * Response:
 * 200 OK
 * {
 *   success: true
 * }
 *
 * Error Responses:
 * - 401 Unauthorized: Missing or invalid authentication
 * - 405 Method Not Allowed: HTTP method is not DELETE
 * - 500 Internal Server Error: Database error
 *
 * Security & Idempotency:
 * - Always returns 200 success (never 404), even if:
 *   - Token doesn't exist (prevents information leakage)
 *   - Token already revoked (idempotency)
 *   - Token belongs to different tenant (prevents information leakage)
 * - Logical delete only (sets revoked_at, preserves audit trail)
 * - revoked_at timestamp is immutable (first revocation time preserved)
 * - RLS ensures tenant isolation
 */
export async function action({ request, params }: ActionFunctionArgs) {
  try {
    // 1. Verify HTTP method is DELETE (action handles POST/PUT/PATCH/DELETE)
    if (request.method !== 'DELETE') {
      return json({ error: 'Method not allowed' }, { status: 405 });
    }

    // 2. Authentication check using requireAuth middleware
    // This throws a redirect to /login if not authenticated
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 3. Validate URL parameter
    const tokenId = params['id'];
    if (!tokenId) {
      return json({ error: 'Token ID is required' }, { status: 400 });
    }

    // 4. Call service layer to revoke token
    // Service always succeeds (no throws) for idempotency and information leakage prevention
    await revokeToken(tenantId, tokenId);

    // 5. Return success response
    // Always 200, even if token doesn't exist or already revoked
    return json({ success: true }, { status: 200 });
  } catch (error) {
    // Handle errors and return appropriate HTTP status codes

    // Handle requireAuth() redirect (API should return 401 instead of redirect)
    // requireAuth() throws a Response with status 302 when user is not authenticated
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle service layer errors (database errors - shouldn't happen as service catches all)
    if (error instanceof Error) {
      // Log detailed error for debugging
      console.error('Failed to revoke API token:', error);

      // Return generic error message to client (don't expose internal details)
      return json({ error: 'Failed to revoke API token' }, { status: 500 });
    }

    // Handle unexpected errors (shouldn't happen, but just in case)
    console.error('Unexpected error in DELETE /api/tokens/:id:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
