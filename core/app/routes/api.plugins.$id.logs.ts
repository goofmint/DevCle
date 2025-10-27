/**
 * Plugin Logs API - Get Execution Logs
 *
 * Provides paginated execution logs for a specific plugin.
 * Supports filtering by status and pagination.
 *
 * Endpoint:
 * - GET /api/plugins/:id/logs?limit=50&offset=0&status=success
 *
 * Security:
 * - Authentication required (requireAuth)
 * - Tenant isolation via RLS (withTenantContext)
 * - UUID validation for plugin IDs
 * - Pagination validation (limit: 1-100, offset: >= 0)
 */

import {
  json,
  type LoaderFunctionArgs,
} from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { withTenantContext } from '../../db/connection.js';
import * as schema from '../../db/schema/index.js';
import { eq, and, desc, count as drizzleCount } from 'drizzle-orm';
import {
  isValidUUID,
  isValidStatus,
  parseLimit,
  parseOffset,
} from '../utils/validation.js';
import type {
  PluginLogsResponse,
  PluginLogEntry,
  ApiErrorResponse,
} from '../types/plugin-api.js';

/**
 * GET /api/plugins/:id/logs - Get plugin execution logs
 *
 * Returns paginated execution logs for a specific plugin.
 * Calculates duration for completed runs (finishedAt - startedAt).
 * Extracts error message from result JSON if status is 'failed'.
 *
 * Query Parameters:
 * - limit: Number of logs to return (1-100, default 50)
 * - offset: Number of logs to skip (>= 0, default 0)
 * - status: Filter by status ('running' | 'success' | 'failed', optional)
 *
 * Response:
 * 200 OK
 * {
 *   logs: [
 *     {
 *       runId: "uuid",
 *       hookName: "sync-data",
 *       status: "success",
 *       startedAt: "2025-01-01T00:00:00.000Z",
 *       finishedAt: "2025-01-01T00:01:00.000Z",
 *       duration: 60000,
 *       error: null,
 *       result: {...}
 *     }
 *   ],
 *   total: 100,
 *   pagination: {
 *     limit: 50,
 *     offset: 0,
 *     hasMore: true
 *   }
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid plugin ID or query parameters
 * - 401 Unauthorized: Not authenticated
 * - 404 Not Found: Plugin not found
 * - 500 Internal Server Error: Database error
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Validate plugin ID format
    const pluginId = params['id'];
    if (!isValidUUID(pluginId)) {
      const errorResponse: ApiErrorResponse = {
        status: 400,
        message: 'Invalid plugin ID format (must be UUID)',
        code: 'INVALID_UUID',
      };
      return json(errorResponse, { status: 400 });
    }

    // 3. Parse and validate query parameters
    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams, 50);
    const offset = parseOffset(url.searchParams, 0);
    const statusParam = url.searchParams.get('status');

    // Validate status filter if provided
    if (statusParam && !isValidStatus(statusParam)) {
      const errorResponse: ApiErrorResponse = {
        status: 400,
        message: 'Invalid status filter (must be "running", "success", or "failed")',
        code: 'INVALID_STATUS',
      };
      return json(errorResponse, { status: 400 });
    }

    // 4. Verify plugin exists and belongs to tenant
    const pluginExists = await withTenantContext(tenantId, async (tx) => {
      const result = await tx
        .select({ pluginId: schema.plugins.pluginId })
        .from(schema.plugins)
        .where(eq(schema.plugins.pluginId, pluginId))
        .limit(1);

      return result.length > 0;
    });

    if (!pluginExists) {
      const errorResponse: ApiErrorResponse = {
        status: 404,
        message: 'Plugin not found',
        code: 'PLUGIN_NOT_FOUND',
      };
      return json(errorResponse, { status: 404 });
    }

    // 5. Build query conditions
    const conditions = [eq(schema.pluginRuns.pluginId, pluginId)];
    if (statusParam) {
      conditions.push(eq(schema.pluginRuns.status, statusParam));
    }

    // 6. Query plugin_runs table with pagination
    const [logsData, totalData] = await withTenantContext(tenantId, async (tx) => {
      // Get logs with pagination
      const logs = await tx
        .select()
        .from(schema.pluginRuns)
        .where(and(...conditions))
        .orderBy(desc(schema.pluginRuns.startedAt))
        .limit(limit)
        .offset(offset);

      // Get total count for pagination metadata
      const totalResult = await tx
        .select({ count: drizzleCount() })
        .from(schema.pluginRuns)
        .where(and(...conditions));

      return [logs, totalResult[0]?.count || 0];
    });

    // 7. Transform database records to API response format
    const logs: PluginLogEntry[] = logsData.map((run) => {
      // Calculate duration if run is completed
      const duration =
        run.finishedAt && run.startedAt
          ? run.finishedAt.getTime() - run.startedAt.getTime()
          : null;

      // Extract error message from result JSON if status is 'failed'
      let error: string | undefined = undefined;
      if (run.status === 'failed' && run.result) {
        const resultObj = run.result as Record<string, unknown>;
        const errors = resultObj['errors'];
        if (errors && Array.isArray(errors) && errors.length > 0) {
          const firstError = errors[0] as Record<string, unknown>;
          const errorMessage = firstError['errorMessage'];
          error = String(errorMessage || 'Unknown error');
        }
      }

      // Build log entry, only include error if it exists
      const logEntry: PluginLogEntry = {
        runId: run.runId,
        hookName: run.trigger, // 'trigger' maps to 'hookName' in API
        status: run.status as 'running' | 'success' | 'failed',
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
        duration,
        result: run.result,
      };

      // Only add error field if it exists (to avoid undefined vs string conflict)
      if (error !== undefined) {
        logEntry.error = error;
      }

      return logEntry;
    });

    // 8. Build pagination metadata
    const response: PluginLogsResponse = {
      logs,
      total: totalData,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < totalData,
      },
    };

    return json(response, { status: 200 });
  } catch (error) {
    // Log error for debugging
    console.error('Error getting plugin logs:', error);

    // Return generic error response
    const errorResponse: ApiErrorResponse = {
      status: 500,
      message: 'Failed to get plugin logs',
    };
    return json(errorResponse, { status: 500 });
  }
}
