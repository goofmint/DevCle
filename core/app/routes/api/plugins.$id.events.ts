/**
 * Plugin Events List API
 *
 * GET /api/plugins/:id/events
 * Returns paginated list of plugin events with filtering and sorting.
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '../../middleware/auth.js';
import { listPluginEvents, ListEventsSchema } from '../../../services/plugin-events/index.js';

/**
 * GET handler for plugin events list
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - perPage: Items per page (default: 20, max: 100)
 * - status: Filter by status (pending/processed/failed)
 * - eventType: Filter by event type
 * - startDate: Filter by start date (ISO 8601)
 * - endDate: Filter by end date (ISO 8601)
 * - sort: Sort order (asc/desc, default: desc)
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  // Authentication check
  const user = await requireAuth(request);
  const pluginId = params['id'];

  if (!pluginId) {
    throw new Response('Plugin ID is required', { status: 400 });
  }

  // Parse and validate query parameters
  const url = new URL(request.url);
  const searchParams = Object.fromEntries(url.searchParams);

  const parseResult = ListEventsSchema.safeParse(searchParams);

  if (!parseResult.success) {
    return json(
      {
        error: 'Invalid query parameters',
        details: parseResult.error.format(),
      },
      { status: 400 }
    );
  }

  // Get events list
  try {
    const result = await listPluginEvents(
      user.tenantId,
      pluginId,
      parseResult.data
    );

    return json(result);
  } catch (error) {
    console.error('Error listing plugin events:', error);
    return json(
      { error: 'Failed to list plugin events' },
      { status: 500 }
    );
  }
}
