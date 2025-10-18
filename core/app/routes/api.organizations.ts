/**
 * Organizations API - List organizations
 *
 * Endpoint: GET /api/organizations
 *
 * Returns list of organizations (organizationId and name only) for use in dropdowns and filters.
 * Results are sorted alphabetically by name.
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { getAllOrganizations } from '../../services/organization.service.js';

/**
 * GET /api/organizations
 *
 * Response:
 * 200 OK
 * {
 *   organizations: [
 *     {
 *       organizationId: "uuid",
 *       name: "Example Corp"
 *     }
 *   ]
 * }
 *
 * Error Responses:
 * - 401 Unauthorized: Missing or invalid authentication
 * - 500 Internal Server Error: Database error
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Fetch organizations using service layer
    // Service handles tenant context via withTenantContext()
    const organizations = await getAllOrganizations(tenantId);

    // 3. Return organizations list (empty array if no organizations exist)
    return json({ organizations }, { status: 200 });
  } catch (error) {
    // 4. Handle errors

    // Handle requireAuth() redirect (API should return 401 instead of redirect)
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle service layer errors
    if (error instanceof Error) {
      console.error('Failed to list organizations:', error);
      return json(
        { error: 'Failed to retrieve organizations' },
        { status: 500 }
      );
    }

    // Handle unexpected errors
    console.error('Unexpected error in GET /api/organizations:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
