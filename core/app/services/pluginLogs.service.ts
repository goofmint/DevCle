/**
 * Plugin Logs Service
 *
 * Business logic for plugin execution logs.
 * Handles log retrieval, sanitization, and plugin validation.
 */

import { withTenantContext } from '../../db/connection.js';
import * as schema from '../../db/schema/index.js';
import { eq, and, desc, count } from 'drizzle-orm';

/**
 * Ensure plugin exists and belongs to tenant
 *
 * @param tenantId - Tenant ID
 * @param pluginId - Plugin ID
 * @throws Error if plugin not found
 * @returns Plugin record
 */
export async function ensurePluginExists(tenantId: string, pluginId: string) {
  return await withTenantContext(tenantId, async (tx) => {
    const [plugin] = await tx
      .select()
      .from(schema.plugins)
      .where(
        and(
          eq(schema.plugins.pluginId, pluginId),
          eq(schema.plugins.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    return plugin;
  });
}

/**
 * List plugin execution logs with pagination
 *
 * @param tenantId - Tenant ID
 * @param pluginId - Plugin ID
 * @param limit - Number of logs to fetch (1-100)
 * @param offset - Offset for pagination
 * @param status - Optional status filter ('running' | 'success' | 'failed')
 * @returns Array of log records
 */
export async function listPluginLogs(
  tenantId: string,
  pluginId: string,
  limit: number,
  offset: number,
  status?: string
) {
  return await withTenantContext(tenantId, async (tx) => {
    const conditions = [
      eq(schema.pluginRuns.pluginId, pluginId),
      eq(schema.pluginRuns.tenantId, tenantId),
    ];

    // Add status filter if provided
    if (status) {
      conditions.push(eq(schema.pluginRuns.status, status));
    }

    return await tx
      .select()
      .from(schema.pluginRuns)
      .where(and(...conditions))
      .orderBy(desc(schema.pluginRuns.startedAt))
      .limit(limit)
      .offset(offset);
  });
}

/**
 * Get total count of logs for a plugin
 *
 * @param tenantId - Tenant ID
 * @param pluginId - Plugin ID
 * @param status - Optional status filter ('running' | 'success' | 'failed')
 * @returns Total log count
 */
export async function getPluginLogsCount(
  tenantId: string,
  pluginId: string,
  status?: string
) {
  return await withTenantContext(tenantId, async (tx) => {
    const conditions = [
      eq(schema.pluginRuns.pluginId, pluginId),
      eq(schema.pluginRuns.tenantId, tenantId),
    ];

    // Add status filter if provided
    if (status) {
      conditions.push(eq(schema.pluginRuns.status, status));
    }

    const [result] = await tx
      .select({ count: count() })
      .from(schema.pluginRuns)
      .where(and(...conditions));

    return result ? Number(result.count) : 0;
  });
}

/**
 * Sanitize execution result to remove sensitive data
 *
 * Redacts fields that may contain secrets, tokens, passwords, etc.
 *
 * @param result - Raw execution result
 * @returns Sanitized result
 */
export function sanitizeResult(result: unknown): unknown {
  if (!result || typeof result !== 'object') {
    return result;
  }

  const sensitivePattern =
    /token|secret|password|authorization|cookie|api[-_]?key|auth[-_]?token|bearer|credentials?/i;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(result)) {
    if (sensitivePattern.test(key)) {
      sanitized[key] = '***REDACTED***';
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) => sanitizeResult(item));
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeResult(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Get last run timestamp per trigger (job name)
 *
 * Computes the most recent execution time for each trigger using SQL aggregation.
 *
 * @param tenantId - Tenant ID
 * @param pluginId - Plugin ID
 * @returns Map of trigger name to last run timestamp
 */
export async function getLastRunsPerTrigger(
  tenantId: string,
  pluginId: string
): Promise<Map<string, Date>> {
  const results = await withTenantContext(tenantId, async (tx) => {
    return await tx
      .select({
        trigger: schema.pluginRuns.trigger,
        lastRun: schema.pluginRuns.startedAt,
      })
      .from(schema.pluginRuns)
      .where(
        and(
          eq(schema.pluginRuns.pluginId, pluginId),
          eq(schema.pluginRuns.tenantId, tenantId),
          eq(schema.pluginRuns.status, 'success')
        )
      )
      .orderBy(desc(schema.pluginRuns.startedAt));
  });

  // Group by trigger and take the most recent
  const lastRuns = new Map<string, Date>();
  for (const row of results) {
    if (!lastRuns.has(row.trigger)) {
      lastRuns.set(row.trigger, row.lastRun);
    }
  }

  return lastRuns;
}
