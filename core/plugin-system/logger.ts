/**
 * Plugin Job Logger Module
 *
 * Provides logging functionality for plugin job executions.
 * Logs job runs to the plugin_runs table for monitoring and debugging.
 *
 * Key Features:
 * - Logs job start/completion to plugin_runs table
 * - Records execution duration, status, and metadata
 * - Integrates with existing plugin_runs schema
 * - Tenant-isolated logging via RLS
 *
 * Usage Example:
 * ```typescript
 * const runId = await startJobRun('plugin-id', 'default', 'sync-data');
 * try {
 *   // Execute job...
 *   await finishJobRun(runId, 'success', { count: 100 });
 * } catch (error) {
 *   await finishJobRun(runId, 'failed', undefined, error.message);
 * }
 * ```
 */

import { eq, and, desc } from 'drizzle-orm';
import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import type { JobMetadata } from './scheduler.js';

/**
 * Start a job run record
 *
 * Creates a new record in plugin_runs with status='running'.
 * Returns the run ID for later updates.
 *
 * @param pluginId - Plugin UUID
 * @param tenantId - Tenant ID for RLS
 * @param jobName - Job name
 * @param jobId - BullMQ job ID (optional, for traceability)
 *
 * @returns Run ID (UUID) of the created record
 *
 * @example
 * ```typescript
 * const runId = await startJobRun(
 *   '123e4567-e89b-12d3-a456-426614174000',
 *   'default',
 *   'sync-analytics'
 * );
 * ```
 */
export async function startJobRun(
  pluginId: string,
  tenantId: string,
  jobName: string,
  jobId?: string
): Promise<string> {
  return await withTenantContext(tenantId, async (tx) => {
    // Prepare initial metadata
    const metadata: Partial<JobMetadata> = {
      jobName,
      timestamp: new Date(),
      attemptsMade: 0,
    };

    if (jobId) {
      metadata.jobId = jobId;
    }

    // Insert plugin run record with status='running'
    const [run] = await tx
      .insert(schema.pluginRuns)
      .values({
        tenantId,
        pluginId,
        trigger: 'job', // Job trigger type
        startedAt: new Date(),
        finishedAt: null, // Not finished yet
        status: 'running',
        result: metadata as unknown as Record<string, unknown>,
      })
      .returning({ runId: schema.pluginRuns.runId });

    if (!run) {
      throw new Error('Failed to insert job run record');
    }

    return run.runId;
  });
}

/**
 * Finish a job run record
 *
 * Updates the plugin_runs record with completion status and metadata.
 * Sets finishedAt timestamp and final status (success/failed/partial).
 *
 * @param runId - Run ID from startJobRun()
 * @param status - Final status ('success' | 'failed' | 'partial')
 * @param metadata - Job completion metadata (optional)
 * @param errorMessage - Error message if failed (optional)
 *
 * @example
 * ```typescript
 * await finishJobRun(
 *   runId,
 *   'success',
 *   {
 *     jobId: '123',
 *     jobName: 'sync-data',
 *     attemptsMade: 1,
 *     timestamp: new Date(),
 *     data: { recordsProcessed: 500 }
 *   }
 * );
 * ```
 */
export async function finishJobRun(
  runId: string,
  status: 'success' | 'failed' | 'partial',
  metadata?: JobMetadata,
  errorMessage?: string
): Promise<void> {
  // Get existing run to extract tenant ID for RLS
  // We need to query first to get the tenant ID, then update with tenant context
  const { getDb } = await import('../db/connection.js');
  const db = getDb();

  const [existingRun] = await db
    .select({ tenantId: schema.pluginRuns.tenantId })
    .from(schema.pluginRuns)
    .where(eq(schema.pluginRuns.runId, runId))
    .limit(1);

  if (!existingRun) {
    throw new Error(`Plugin run with ID ${runId} not found`);
  }

  // Update run record with tenant context
  await withTenantContext(existingRun.tenantId, async (tx) => {
    // Build result object
    const result: Record<string, unknown> = {
      ...(metadata ?? {}),
    };

    // Add error message to result if present
    if (errorMessage) {
      result['error'] = errorMessage;
    }

    // Update plugin run record
    await tx
      .update(schema.pluginRuns)
      .set({
        finishedAt: new Date(),
        status,
        result,
      })
      .where(eq(schema.pluginRuns.runId, runId));
  });
}

/**
 * Log a complete job execution (start and finish in one call)
 *
 * Convenience function that creates a plugin_runs record with
 * both start and finish times already set. Use this for quick
 * synchronous jobs or when you already have the execution result.
 *
 * @param pluginId - Plugin UUID
 * @param tenantId - Tenant ID for RLS
 * @param jobName - Job name
 * @param status - Execution status
 * @param metadata - Job metadata
 * @param errorMessage - Error message if failed (optional)
 *
 * @returns Run ID of the created record
 *
 * @example
 * ```typescript
 * await logJobExecution(
 *   'plugin-uuid',
 *   'default',
 *   'quick-task',
 *   'success',
 *   {
 *     jobId: '456',
 *     jobName: 'quick-task',
 *     attemptsMade: 1,
 *     timestamp: new Date(),
 *     data: { result: 'done' }
 *   }
 * );
 * ```
 */
export async function logJobExecution(
  pluginId: string,
  tenantId: string,
  jobName: string,
  status: 'success' | 'failed' | 'partial',
  metadata?: JobMetadata,
  errorMessage?: string
): Promise<string> {
  return await withTenantContext(tenantId, async (tx) => {
    // Build result object
    const result: Record<string, unknown> = {
      jobName,
      timestamp: new Date(),
      ...(metadata ?? {}),
    };

    if (errorMessage) {
      result['error'] = errorMessage;
    }

    // Insert plugin run record with immediate completion
    const now = new Date();
    const [run] = await tx
      .insert(schema.pluginRuns)
      .values({
        tenantId,
        pluginId,
        trigger: 'job',
        startedAt: now,
        finishedAt: now, // Finished immediately
        status,
        result,
      })
      .returning({ runId: schema.pluginRuns.runId });

    if (!run) {
      throw new Error('Failed to insert job run record');
    }

    return run.runId;
  });
}

/**
 * Get job execution history for a plugin
 *
 * Retrieves recent job runs from plugin_runs table.
 * Useful for monitoring and debugging.
 *
 * @param pluginId - Plugin UUID
 * @param tenantId - Tenant ID for RLS
 * @param limit - Maximum number of records to return (default: 10)
 *
 * @returns Array of job run records, ordered by started_at DESC
 *
 * @example
 * ```typescript
 * const history = await getJobHistory('plugin-uuid', 'default', 20);
 * for (const run of history) {
 *   console.log(`${run.status}: ${run.result.jobName} at ${run.startedAt}`);
 * }
 * ```
 */
export async function getJobHistory(
  pluginId: string,
  tenantId: string,
  limit: number = 10
): Promise<
  Array<{
    runId: string;
    trigger: string;
    startedAt: Date;
    finishedAt: Date | null;
    status: string;
    result: Record<string, unknown> | null;
  }>
> {
  return await withTenantContext(tenantId, async (tx) => {
    const runs = await tx
      .select({
        runId: schema.pluginRuns.runId,
        trigger: schema.pluginRuns.trigger,
        startedAt: schema.pluginRuns.startedAt,
        finishedAt: schema.pluginRuns.finishedAt,
        status: schema.pluginRuns.status,
        result: schema.pluginRuns.result,
      })
      .from(schema.pluginRuns)
      .where(
        and(
          eq(schema.pluginRuns.pluginId, pluginId),
          eq(schema.pluginRuns.trigger, 'job')
        )
      )
      .orderBy(desc(schema.pluginRuns.startedAt))
      .limit(limit);

    return runs.map((run) => ({
      runId: run.runId,
      trigger: run.trigger,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      status: run.status,
      result: run.result as Record<string, unknown> | null,
    }));
  });
}
