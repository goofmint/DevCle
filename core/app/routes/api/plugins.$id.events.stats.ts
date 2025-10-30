/**
 * Plugin Events Statistics API
 *
 * GET /api/plugins/:id/events/stats
 * Returns aggregated statistics for plugin events.
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '../../middleware/auth.js';
import { getPluginEventsStats } from '../../../services/plugin-events/index.js';

/**
 * GET handler for plugin events statistics
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  // Authentication check
  const user = await requireAuth(request);
  const pluginId = params['id'];

  if (!pluginId) {
    throw new Response('Plugin ID is required', { status: 400 });
  }

  // Get statistics
  try {
    const stats = await getPluginEventsStats(user.tenantId, pluginId);

    return json(stats);
  } catch (error) {
    console.error('Error getting plugin events stats:', error);
    return json(
      { error: 'Failed to get plugin events statistics' },
      { status: 500 }
    );
  }
}
