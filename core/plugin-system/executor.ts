/**
 * Plugin Job Executor
 *
 * Executes plugin jobs manually or via cron scheduler.
 * Handles job lifecycle, retry logic, timeout, and cursor management.
 *
 * Key Features:
 * - Manual and cron-triggered execution
 * - Timeout control per job
 * - Retry with exponential backoff
 * - Cursor-based incremental sync
 * - Execution logging to plugin_runs table
 *
 * Architecture:
 * 1. Read job definition from plugin.json
 * 2. Create plugin_runs record (status: pending)
 * 3. Update to running status
 * 4. Execute job (call plugin route)
 * 5. Complete with success/failed status
 */

import type { PluginJob, PluginManifest } from './types.js';
import type { PluginRunMetadata } from '../services/plugin-run.service.js';
import {
  createPluginRun,
  startPluginRun,
  completePluginRun,
  getLastSuccessfulRun,
} from '../services/plugin-run.service.js';
import { loadPluginManifest } from './types.js';

/**
 * Minimal result returned by executePluginJob.
 * For complete details (tenantId, pluginId, jobName, startedAt, completedAt, metadata),
 * fetch the full PluginRun record using getPluginRun(runId).
 */
export interface PluginRunResult {
  /** Run ID (for fetching full record) */
  runId: string;
  /** Execution status */
  status: 'success' | 'failed';
  /** Number of events processed */
  eventsProcessed: number;
  /** Error message (if failed) */
  errorMessage?: string;
  /** Execution duration in milliseconds */
  duration: number;
  /** Updated metadata (cursor, retryCount, etc.) */
  metadata?: PluginRunMetadata;
}

/**
 * Execute a plugin job manually or via cron scheduler
 *
 * This function handles the complete job execution lifecycle:
 * 1. Load plugin.json and find job definition
 * 2. Create plugin_runs record (pending)
 * 3. Start execution (running)
 * 4. Call plugin route with timeout
 * 5. Complete with result (success/failed)
 *
 * Returns a minimal result. Caller should fetch the full PluginRun record
 * from plugin-run.service.ts using getPluginRun(runId) for complete details.
 *
 * @param tenantId - Tenant ID for RLS and data isolation
 * @param pluginId - Plugin ID (UUID from plugins table)
 * @param pluginKey - Plugin key (e.g., "drowl-plugin-test")
 * @param jobName - Job name from plugin.json jobs[]
 * @param metadata - Optional metadata (cursor for incremental sync)
 * @returns Minimal execution result with runId
 * @throws Error if plugin.json not found, job not defined, or execution fails
 *
 * @example
 * ```typescript
 * const result = await executePluginJob(
 *   'default',
 *   'plugin-uuid',
 *   'drowl-plugin-test',
 *   'sync-data'
 * );
 * console.log(`Job completed: ${result.status}, runId: ${result.runId}`);
 * ```
 */
export async function executePluginJob(
  tenantId: string,
  pluginId: string,
  pluginKey: string,
  jobName: string,
  metadata?: PluginRunMetadata
): Promise<PluginRunResult> {
  const startTime = Date.now();

  // Step 1: Load plugin manifest and find job definition
  const manifest = await loadPluginManifest(pluginKey);
  const jobDef = manifest.jobs.find((j) => j.name === jobName);

  if (!jobDef) {
    throw new Error(
      `Job "${jobName}" not found in plugin.json for plugin "${pluginKey}"`
    );
  }

  // Step 2: Get last successful run (for cursor)
  const lastRun = await getLastSuccessfulRun(tenantId, pluginId, jobName);
  const initialMetadata: PluginRunMetadata = metadata ?? lastRun?.metadata ?? {};

  // Step 3: Create plugin run record (status: pending)
  const runId = await createPluginRun(tenantId, pluginId, jobName, initialMetadata);

  try {
    // Step 4: Update to running status
    await startPluginRun(tenantId, runId);

    // Step 5: Execute job with timeout and retry
    const result = await executeJobWithRetry(
      tenantId,
      pluginId,
      pluginKey,
      jobDef,
      initialMetadata
    );

    // Step 6: Complete with success
    const duration = Date.now() - startTime;
    await completePluginRun(tenantId, runId, {
      status: 'success',
      eventsProcessed: result.eventsProcessed,
      metadata: result.metadata,
    });

    return {
      runId,
      status: 'success',
      eventsProcessed: result.eventsProcessed,
      duration,
      metadata: result.metadata,
    };
  } catch (error) {
    // Step 6b: Complete with failure
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    await completePluginRun(tenantId, runId, {
      status: 'failed',
      eventsProcessed: 0,
      errorMessage,
      metadata: {
        ...initialMetadata,
        error: errorMessage,
        retryCount: (initialMetadata.retryCount ?? 0) + 1,
      },
    });

    return {
      runId,
      status: 'failed',
      eventsProcessed: 0,
      errorMessage,
      duration,
    };
  }
}

/**
 * Execute job with retry logic
 *
 * Calls the plugin route with timeout and retry configuration.
 * Uses exponential backoff for retries.
 *
 * @param tenantId - Tenant ID
 * @param pluginId - Plugin ID
 * @param pluginKey - Plugin key
 * @param jobDef - Job definition from plugin.json
 * @param metadata - Metadata (cursor, retryCount, etc.)
 * @returns Execution result
 * @throws Error if all retry attempts fail
 * @private
 */
async function executeJobWithRetry(
  tenantId: string,
  pluginId: string,
  pluginKey: string,
  jobDef: PluginJob,
  metadata: PluginRunMetadata
): Promise<{ eventsProcessed: number; metadata: PluginRunMetadata }> {
  const maxAttempts = (jobDef.retry?.max ?? 0) + 1; // +1 for initial attempt
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Add delay for retry attempts (exponential backoff)
      if (attempt > 0 && jobDef.retry?.backoffSec) {
        const delayIndex = Math.min(attempt - 1, jobDef.retry.backoffSec.length - 1);
        const delaySec = jobDef.retry.backoffSec[delayIndex];
        await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
      }

      // Execute job with timeout
      const result = await executeJobWithTimeout(
        tenantId,
        pluginId,
        pluginKey,
        jobDef,
        metadata,
        jobDef.timeoutSec
      );

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `Job execution attempt ${attempt + 1}/${maxAttempts} failed:`,
        lastError.message
      );

      // If this was the last attempt, throw the error
      if (attempt === maxAttempts - 1) {
        throw lastError;
      }
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError ?? new Error('Job execution failed with unknown error');
}

/**
 * Execute job with timeout
 *
 * Calls the plugin route and enforces timeout.
 * This is a placeholder implementation. In a real system, this would:
 * 1. Resolve the plugin route URL
 * 2. Call the route with HTTP request (POST /plugins/:id/:route)
 * 3. Parse the response
 * 4. Extract eventsProcessed and new cursor
 *
 * For now, this returns a mock result.
 *
 * @param tenantId - Tenant ID
 * @param pluginId - Plugin ID
 * @param pluginKey - Plugin key
 * @param jobDef - Job definition
 * @param metadata - Metadata (cursor, etc.)
 * @param timeoutSec - Timeout in seconds
 * @returns Execution result
 * @throws Error if timeout or execution fails
 * @private
 */
async function executeJobWithTimeout(
  tenantId: string,
  pluginId: string,
  pluginKey: string,
  jobDef: PluginJob,
  metadata: PluginRunMetadata,
  timeoutSec: number
): Promise<{ eventsProcessed: number; metadata: PluginRunMetadata }> {
  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Job execution timeout after ${timeoutSec} seconds`));
    }, timeoutSec * 1000);
  });

  // Create execution promise
  const executionPromise = callPluginRoute(
    tenantId,
    pluginId,
    pluginKey,
    jobDef,
    metadata
  );

  // Race between execution and timeout
  return await Promise.race([executionPromise, timeoutPromise]);
}

/**
 * Call plugin route (placeholder implementation)
 *
 * This is a placeholder that returns mock data.
 * In a real implementation, this would:
 * 1. Construct the plugin route URL (e.g., http://plugin-server:3000/plugins/:id/sync)
 * 2. Send HTTP POST request with metadata (cursor, etc.)
 * 3. Parse response JSON
 * 4. Extract eventsProcessed and new cursor
 *
 * For now, this simulates a successful sync operation.
 *
 * @param tenantId - Tenant ID
 * @param pluginId - Plugin ID
 * @param pluginKey - Plugin key
 * @param jobDef - Job definition
 * @param metadata - Metadata (cursor, etc.)
 * @returns Mock execution result
 * @private
 */
async function callPluginRoute(
  tenantId: string,
  pluginId: string,
  pluginKey: string,
  jobDef: PluginJob,
  metadata: PluginRunMetadata
): Promise<{ eventsProcessed: number; metadata: PluginRunMetadata }> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Mock successful execution
  // In real implementation, this would be:
  // const response = await fetch(`http://plugin-server:3000${jobDef.route}`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ tenantId, pluginId, cursor: metadata.cursor })
  // });
  // const data = await response.json();
  // return { eventsProcessed: data.eventsProcessed, metadata: { cursor: data.cursor } };

  return {
    eventsProcessed: 42, // Mock: processed 42 events
    metadata: {
      cursor: new Date().toISOString(), // Mock: new cursor is current timestamp
      retryCount: 0,
      lastRunAt: new Date().toISOString(),
    },
  };
}
