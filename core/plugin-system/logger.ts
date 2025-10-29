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
 *   await finishJobRun('default', runId, 'success', { count: 100 });
 * } catch (error) {
 *   await finishJobRun('default', runId, 'failed', undefined, error.message);
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
        jobName, // Job name from plugin.json jobs[]
        startedAt: new Date(),
        completedAt: null, // Not completed yet
        status: 'running',
        eventsProcessed: 0,
        errorMessage: null,
        metadata: metadata as unknown as Record<string, unknown>,
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
 * @param tenantId - Tenant ID for RLS (passed from caller context)
 * @param runId - Run ID from startJobRun()
 * @param status - Final status ('success' | 'failed' | 'partial')
 * @param metadata - Job completion metadata (optional)
 * @param errorMessage - Error message if failed (optional)
 *
 * @example
 * ```typescript
 * await finishJobRun(
 *   'default',
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
  tenantId: string,
  runId: string,
  status: 'success' | 'failed' | 'partial',
  metadata?: JobMetadata,
  errorMessage?: string
): Promise<void> {
  // Update run record with tenant context directly
  await withTenantContext(tenantId, async (tx) => {
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
        completedAt: new Date(),
        status,
        eventsProcessed: (metadata?.data && typeof metadata.data === 'object' && 'recordsProcessed' in metadata.data && typeof metadata.data.recordsProcessed === 'number') ? metadata.data.recordsProcessed : 0,
        errorMessage: errorMessage ?? null,
        metadata: result,
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
        jobName,
        startedAt: now,
        completedAt: now, // Completed immediately
        status,
        eventsProcessed: (metadata?.data && typeof metadata.data === 'object' && 'recordsProcessed' in metadata.data && typeof metadata.data.recordsProcessed === 'number') ? metadata.data.recordsProcessed : 0,
        errorMessage: errorMessage ?? null,
        metadata: result,
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
    jobName: string;
    startedAt: Date;
    completedAt: Date | null;
    status: string;
    eventsProcessed: number;
    errorMessage: string | null;
    metadata: Record<string, unknown> | null;
  }>
> {
  return await withTenantContext(tenantId, async (tx) => {
    const runs = await tx
      .select({
        runId: schema.pluginRuns.runId,
        jobName: schema.pluginRuns.jobName,
        startedAt: schema.pluginRuns.startedAt,
        completedAt: schema.pluginRuns.completedAt,
        status: schema.pluginRuns.status,
        eventsProcessed: schema.pluginRuns.eventsProcessed,
        errorMessage: schema.pluginRuns.errorMessage,
        metadata: schema.pluginRuns.metadata,
      })
      .from(schema.pluginRuns)
      .where(eq(schema.pluginRuns.pluginId, pluginId))
      .orderBy(desc(schema.pluginRuns.startedAt))
      .limit(limit);

    return runs.map((run) => ({
      runId: run.runId,
      jobName: run.jobName,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      status: run.status,
      eventsProcessed: run.eventsProcessed,
      errorMessage: run.errorMessage,
      metadata: run.metadata as Record<string, unknown> | null,
    }));
  });
}
