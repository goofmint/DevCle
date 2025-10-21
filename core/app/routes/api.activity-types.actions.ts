/**
 * Activity Types Actions API Route
 *
 * Returns list of existing action names for ActionCombobox dropdown.
 *
 * Endpoints:
 * - GET /api/activity-types/actions - Get list of existing action names
 *
 * Security:
 * - Authenticated users only
 * - Tenant-scoped via requireAuth()
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { listActivityTypes } from '../../services/activity-type.service.js';

/**
 * GET /api/activity-types/actions
 *
 * Get list of existing action names for the current tenant.
 * Used by ActionCombobox to populate dropdown options.
 *
 * Response:
 * {
 *   actions: Array<string>
 * }
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Require authentication (not admin-only, member can view)
    const user = await requireAuth(request);

    // Fetch all activity types (up to 100)
    const activityTypes = await listActivityTypes(user.tenantId, { limit: 100, offset: 0 });

    // Extract action names
    const actions = activityTypes.map((at) => at.action);

    return json({ actions });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Failed to get activity type actions:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
