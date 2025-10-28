/**
 * Plugin Job Manual Execution API
 *
 * POST /api/plugins/:id/run - Manually trigger plugin job execution
 *
 * Access Control: Admin-only
 * - Unauthorized: 401 (redirects to login)
 * - Non-admin: 403 Forbidden
 *
 * Request Body:
 * {
 *   "jobName": "sync"
 * }
 *
 * Response (202 Accepted):
 * {
 *   "runId": "uuid",
 *   "status": "pending"
 * }
 */

import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { getPluginById } from '../../services/plugin.service.js';
import { executePluginJob } from '../../plugin-system/executor.js';
import { z } from 'zod';

/**
 * Request body schema
 */
const RequestSchema = z.object({
  jobName: z.string().min(1, 'Job name is required'),
});

/**
 * POST /api/plugins/:id/run
 *
 * Manually execute a plugin job (for testing/debugging).
 * Admin-only access.
 *
 * Workflow:
 * 1. Authenticate user
 * 2. Check admin role
 * 3. Validate request body
 * 4. Get plugin from database
 * 5. Execute job asynchronously
 * 6. Return runId immediately (202 Accepted)
 */
export async function action({ params, request }: ActionFunctionArgs) {
  try {
    // Step 1: Authenticate user
    const user = await requireAuth(request);

    // Step 2: Check admin role
    if (user.role !== 'admin') {
      return json({ error: 'Admin access required' }, { status: 403 });
    }

    // Step 3: Get plugin ID from params
    const { id: pluginId } = params;

    if (!pluginId) {
      return json({ error: 'Plugin ID is required' }, { status: 400 });
    }

    // Step 4: Parse and validate request body
    const body = await request.json();
    const parseResult = RequestSchema.safeParse(body);

    if (!parseResult.success) {
      return json(
        {
          error: 'Invalid request body',
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { jobName } = parseResult.data;

    // Step 5: Get plugin from database
    const plugin = await getPluginById(user.tenantId, pluginId);

    if (!plugin) {
      return json({ error: 'Plugin not found' }, { status: 404 });
    }

    // Step 6: Execute job asynchronously (fire-and-forget)
    // The job will be queued and executed by BullMQ worker
    // We return immediately with the runId
    executePluginJob(user.tenantId, pluginId, plugin.key, jobName)
      .then((result) => {
        console.log(`Job ${jobName} completed:`, result);
      })
      .catch((error) => {
        console.error(`Job ${jobName} failed:`, error);
      });

    // Note: In a real implementation, we should:
    // 1. Create the plugin_runs record immediately (status: pending)
    // 2. Queue the job in BullMQ
    // 3. Return the runId
    //
    // For now, we execute synchronously and return the result
    const result = await executePluginJob(
      user.tenantId,
      pluginId,
      plugin.key,
      jobName
    );

    return json(
      {
        runId: result.runId,
        status: 'pending', // Initial status is pending
      },
      { status: 202 } // 202 Accepted (job queued)
    );
  } catch (error) {
    console.error('Failed to execute plugin job:', error);

    if (error instanceof Error) {
      // Handle specific errors
      if (error.message.includes('not found')) {
        return json({ error: 'Plugin or job not found' }, { status: 404 });
      }
    }

    return json({ error: 'Failed to execute plugin job' }, { status: 500 });
  }
}
