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
 * - RBAC: Requires valid role (admin or member)
 * - Tenant isolation via service layer
 * - UUID validation for plugin IDs
 * - Pagination validation (limit: 1-100, offset: >= 0)
 * - Sensitive data redaction in execution results
 */

import {
  json,
  type LoaderFunctionArgs,
} from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import {
  ensurePluginExists,
  listPluginLogs,
  getPluginLogsCount,
  sanitizeResult,
} from '~/services/pluginLogs.service.js';
import {
  isValidUUID,
  isValidStatus,
  parseLimit,
  parseOffset,
} from '~/utils/validation.js';
import type {
  PluginLogsResponse,
  PluginLogEntry,
  ApiErrorResponse,
} from '~/types/plugin-api.js';

/**
 * GET /api/plugins/:id/logs - Get plugin execution logs
 *
 * Returns paginated execution logs for a specific plugin.
 * Calculates duration for completed runs (completedAt - startedAt).
 * Uses errorMessage field directly from schema for failed runs.
 * Redacts sensitive fields from execution metadata.
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
 *       error: undefined,
 *       result: {...}  // Sanitized metadata - sensitive fields redacted
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
 * - 403 Forbidden: Insufficient permissions
 * - 404 Not Found: Plugin not found
 * - 500 Internal Server Error: Database error
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. RBAC authorization check
    // For now, both admin and member roles can view logs
    // Future: Implement granular permissions via permissions column
    if (!user.role || !['admin', 'member'].includes(user.role)) {
      const errorResponse: ApiErrorResponse = {
        status: 403,
        message: 'Insufficient permissions to view plugin logs',
        code: 'FORBIDDEN',
      };
      return json(errorResponse, {
        status: 403,
        headers: {
          'Cache-Control': 'no-store',
        },
      });
    }

    // 3. Validate plugin ID format
    const pluginId = params['id'];
    if (!isValidUUID(pluginId)) {
      const errorResponse: ApiErrorResponse = {
        status: 400,
        message: 'Invalid plugin ID format (must be UUID)',
        code: 'INVALID_UUID',
      };
      return json(errorResponse, {
        status: 400,
        headers: {
          'Cache-Control': 'no-store',
        },
      });
    }

    // 4. Parse and validate query parameters
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
      return json(errorResponse, {
        status: 400,
        headers: {
          'Cache-Control': 'no-store',
        },
      });
    }

    // 5. Verify plugin exists (via service layer)
    try {
      await ensurePluginExists(tenantId, pluginId);
    } catch (err) {
      const errorResponse: ApiErrorResponse = {
        status: 404,
        message: 'Plugin not found',
        code: 'PLUGIN_NOT_FOUND',
      };
      return json(errorResponse, {
        status: 404,
        headers: {
          'Cache-Control': 'no-store',
        },
      });
    }

    // 6. Query plugin logs via service (with optional status filter)
    const logsData = await listPluginLogs(tenantId, pluginId, limit, offset, statusParam || undefined);
    const totalData = await getPluginLogsCount(tenantId, pluginId, statusParam || undefined);

    // 7. Transform database records to API response format
    const logs: PluginLogEntry[] = logsData.map((run) => {
      // Calculate duration if run is completed
      const duration =
        run.completedAt && run.startedAt
          ? run.completedAt.getTime() - run.startedAt.getTime()
          : null;

      // Use errorMessage field directly from schema
      const error = run.errorMessage || undefined;

      // Sanitize metadata to remove sensitive data
      const sanitizedResult = run.metadata ? sanitizeResult(run.metadata) : undefined;

      // Build log entry
      const logEntry: PluginLogEntry = {
        runId: run.runId,
        hookName: run.jobName, // 'jobName' maps to 'hookName' in API
        status: run.status as 'running' | 'success' | 'failed',
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.completedAt ? run.completedAt.toISOString() : null,
        duration,
        result: sanitizedResult,
      };

      // Only add error field if it exists
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

    return json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    // Preserve Remix redirects
    if (error instanceof Response) {
      throw error;
    }

    // Log error for debugging
    console.error('Error getting plugin logs:', error);

    // Return generic error response
    const errorResponse: ApiErrorResponse = {
      status: 500,
      message: 'Failed to get plugin logs',
    };
    return json(errorResponse, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }
}
