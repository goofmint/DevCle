/**
 * Developer Identifiers API - Get identifiers for a developer
 *
 * Endpoint: GET /api/developers/:id/identifiers
 *
 * Returns list of identifiers (email, github, twitter, etc.) associated with a developer.
 * Used by developer detail page to display all known identifiers.
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { listIdentifiers } from '../../services/identity-identifiers.service.js';
import { z } from 'zod';

/**
 * UUID validation schema
 */
const UuidSchema = z.string().uuid();

/**
 * GET /api/developers/:id/identifiers
 *
 * Path Parameters:
 * - id: Developer ID (UUID)
 *
 * Response:
 * 200 OK
 * {
 *   identifiers: [
 *     {
 *       identifierId: "uuid",
 *       kind: "email",
 *       valueNormalized: "john@example.com",
 *       confidence: "1.0",
 *       firstSeen: "2025-01-01T00:00:00Z",
 *       lastSeen: "2025-01-10T00:00:00Z"
 *     }
 *   ]
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

    // 4. Fetch identifiers using service layer
    // Service handles tenant context via withTenantContext()
    const identifiers = await listIdentifiers(tenantId, developerId);

    // 5. Return identifiers list (empty array if developer not found or has no identifiers)
    return json({ identifiers }, { status: 200 });
  } catch (error) {
    // 6. Handle errors

    // Handle requireAuth() redirect (API should return 401 instead of redirect)
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle service layer errors
    if (error instanceof Error) {
      console.error('Failed to list identifiers:', error);
      return json(
        { error: 'Failed to retrieve identifiers' },
        { status: 500 }
      );
    }

    // Handle unexpected errors
    console.error('Unexpected error in GET /api/developers/:id/identifiers:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
