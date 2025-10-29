/**
 * Plugin Run Details API
 *
 * GET /api/plugins/:id/runs/:runId - Get plugin run details
 *
 * Response (200 OK):
 * {
 *   "runId": "uuid",
 *   "pluginId": "uuid",
 *   "jobName": "sync",
 *   "status": "success",
 *   "startedAt": "2025-10-28T10:00:00Z",
 *   "completedAt": "2025-10-28T10:05:00Z",
 *   "eventsProcessed": 42,
 *   "errorMessage": null,
 *   "metadata": { "cursor": "..." }
 * }
 */

import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { getPluginById } from '../../services/plugin.service.js';
import { getPluginRun } from '../../services/plugin-run.service.js';

/**
 * GET /api/plugins/:id/runs/:runId
 *
 * Retrieves details of a specific plugin run.
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  try {
    // Authenticate user
    const user = await requireAuth(request);

    // Get params
    const { id: pluginId, runId } = params;

    if (!pluginId) {
      return json({ error: 'Plugin ID is required' }, { status: 400 });
    }

    if (!runId) {
      return json({ error: 'Run ID is required' }, { status: 400 });
    }

    // Verify plugin exists
    const plugin = await getPluginById(user.tenantId, pluginId);

    if (!plugin) {
      return json({ error: 'Plugin not found' }, { status: 404 });
    }

    // Get run details
    const run = await getPluginRun(user.tenantId, runId);

    if (!run) {
      return json({ error: 'Plugin run not found' }, { status: 404 });
    }

    // Verify run belongs to this plugin
    if (run.pluginId !== pluginId) {
      return json({ error: 'Plugin run not found' }, { status: 404 });
    }

    return json(run);
  } catch (error) {
    console.error('Failed to get plugin run:', error);
    return json({ error: 'Failed to get plugin run' }, { status: 500 });
  }
}
