/**
 * Plugin Event Detail API
 *
 * GET /api/plugins/:id/events/:eventId
 * Returns detailed information for a specific plugin event including raw data.
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '../../middleware/auth.js';
import { getPluginEventDetail } from '../../../services/plugin-events/index.js';

/**
 * GET handler for plugin event detail
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  // Authentication check
  const user = await requireAuth(request);
  const pluginId = params['id'];
  const eventId = params['eventId'];

  if (!pluginId || !eventId) {
    throw new Response('Plugin ID and Event ID are required', { status: 400 });
  }

  // Get event detail
  try {
    const event = await getPluginEventDetail(
      user.tenantId,
      pluginId,
      eventId
    );

    if (!event) {
      throw new Response('Event not found', { status: 404 });
    }

    return json(event);
  } catch (error) {
    // Re-throw Response errors (404, etc.)
    if (error instanceof Response) {
      throw error;
    }

    console.error('Error getting plugin event detail:', error);
    return json(
      { error: 'Failed to get plugin event detail' },
      { status: 500 }
    );
  }
}
