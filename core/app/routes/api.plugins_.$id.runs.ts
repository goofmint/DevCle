/**
 * Plugin Runs API
 *
 * GET /api/plugins/:id/runs - List plugin execution runs
 *
 * Query Parameters:
 * - status: 'pending' | 'running' | 'success' | 'failed'
 * - jobName: string
 * - limit: number (default: 20, max: 100)
 * - offset: number (default: 0)
 * - sort: 'asc' | 'desc' (default: 'desc')
 *
 * Response (200 OK):
 * {
 *   "runs": [...],
 *   "total": number,
 *   "summary": { total, success, failed, running, pending, avgEventsProcessed, avgDuration }
 * }
 */

import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { getPluginByKey } from '../../services/plugin.service.js';
import { listPluginRuns, getRunSummary } from '../../services/plugin-run.service.js';

/**
 * GET /api/plugins/:id/runs
 *
 * Retrieves paginated list of plugin runs with optional filtering.
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  try {
    // Authenticate user
    const user = await requireAuth(request);

    // Get plugin key from params
    const { id: key } = params;

    if (!key) {
      return json({ error: 'Plugin key is required' }, { status: 400 });
    }

    // Verify plugin exists and get pluginId
    const plugin = await getPluginByKey(user.tenantId, key);

    if (!plugin) {
      return json({ error: 'Plugin not found' }, { status: 404 });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const status = url.searchParams.get('status') as
      | 'pending'
      | 'running'
      | 'success'
      | 'failed'
      | null;
    const jobName = url.searchParams.get('jobName');
    const limit = Math.min(
      Number(url.searchParams.get('limit')) || 20,
      100
    ); // Max 100
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
    const sort = (url.searchParams.get('sort') as 'asc' | 'desc') || 'desc';

    // Get runs and summary in parallel (using plugin.pluginId from DB)
    const [{ runs, total }, summary] = await Promise.all([
      listPluginRuns(user.tenantId, plugin.pluginId, {
        ...(status ? { status } : {}),
        ...(jobName ? { jobName } : {}),
        limit,
        offset,
        sort,
      }),
      getRunSummary(user.tenantId, plugin.pluginId),
    ]);

    return json({
      runs,
      total,
      summary,
    });
  } catch (error) {
    // Re-throw Response objects (e.g., redirects from requireAuth)
    if (error instanceof Response) {
      throw error;
    }

    // Handle plugin not found errors
    if (error instanceof Error && error.message.includes('Plugin not found')) {
      return json({ error: 'Plugin not found' }, { status: 404 });
    }

    console.error('Failed to list plugin runs:', error);
    return json({ error: 'Failed to list plugin runs' }, { status: 500 });
  }
}
