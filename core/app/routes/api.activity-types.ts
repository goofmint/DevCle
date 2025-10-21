/**
 * Activity Types API Route
 *
 * Handles CRUD operations for activity types.
 *
 * Endpoints:
 * - GET /api/activity-types - List all activity types (admin-only)
 * - POST /api/activity-types - Create new activity type (admin-only)
 *
 * Security:
 * - Admin-only access for all operations
 * - Tenant-scoped via requireAuth()
 * - Input validation via Zod schemas
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '../middleware/auth.server.js';
import {
  listActivityTypes,
  createActivityType,
} from '../../core/services/activity-type.service.js';
import {
  ListActivityTypesSchema,
  CreateActivityTypeSchema,
} from '../../core/services/activity-type.schemas.js';

/**
 * GET /api/activity-types
 *
 * List all activity types for the current tenant
 *
 * Query params:
 * - limit: number (default: 50, max: 100)
 * - offset: number (default: 0)
 *
 * Response:
 * {
 *   activityTypes: Array<ActivityType>
 * }
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Require admin authentication
    const user = await requireAuth(request, { requireRole: 'admin' });

    // Parse query params
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');

    const params = ListActivityTypesSchema.parse({
      limit: limitParam ? Number(limitParam) : 50,
      offset: offsetParam ? Number(offsetParam) : 0,
    });

    // Fetch activity types
    const activityTypes = await listActivityTypes(user.tenantId, params);

    return json({ activityTypes });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'Admin role required') {
      return json({ error: 'Admin role required' }, { status: 403 });
    }

    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/activity-types
 *
 * Create a new activity type
 *
 * Request body:
 * {
 *   action: string,
 *   iconName?: string,
 *   colorClass?: string,
 *   stageKey?: string | null
 * }
 *
 * Response:
 * {
 *   activityType: ActivityType
 * }
 *
 * Errors:
 * - 400: Invalid request body
 * - 401: Unauthorized
 * - 403: Admin role required
 * - 409: Activity type with this action already exists
 * - 500: Internal server error
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    // Check method
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, { status: 405 });
    }

    // Require admin authentication
    const user = await requireAuth(request, { requireRole: 'admin' });

    // Parse request body
    const body = await request.json();
    const data = CreateActivityTypeSchema.parse(body);

    // Create activity type
    const activityType = await createActivityType(user.tenantId, data);

    return json({ activityType }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'Admin role required') {
      return json({ error: 'Admin role required' }, { status: 403 });
    }

    // Zod validation error
    if (error instanceof Error && error.name === 'ZodError') {
      return json({ error: 'Invalid request body', details: error }, { status: 400 });
    }

    // Duplicate key error
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return json(
        { error: 'Activity type with this action already exists' },
        { status: 409 }
      );
    }

    if (error instanceof Error && error.message.includes('unique constraint')) {
      return json(
        { error: 'Activity type with this action already exists' },
        { status: 409 }
      );
    }

    console.error('Failed to create activity type:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
