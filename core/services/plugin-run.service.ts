/**
 * Plugin Run Service
 *
 * Manages plugin execution runs and their lifecycle.
 * Provides CRUD operations for plugin_runs table with RLS support.
 *
 * Key Features:
 * - Create/start/complete plugin runs
 * - Query run history with pagination and filtering
 * - Calculate run statistics and summaries
 * - Tenant-isolated operations via RLS
 */

import { eq, and, desc, asc, count, sql } from 'drizzle-orm';
import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';

/**
 * Plugin run metadata stored in JSONB
 *
 * Stores checkpoint information for incremental sync and retry state.
 */
export interface PluginRunMetadata {
  /** Checkpoint for incremental sync (e.g., last_sync_timestamp, next_page_token) */
  cursor?: string;
  /** Number of retries attempted (incremented on transient failures) */
  retryCount?: number;
  /** ISO timestamp of last successful run (ISO 8601 format) */
  lastRunAt?: string;
  /** Error message from last failed attempt (for debugging) */
  error?: string;
  /** Plugin-specific custom fields */
  [key: string]: unknown;
}

/**
 * Plugin run record
 *
 * Represents a single execution of a plugin job.
 */
export interface PluginRun {
  /** Unique run identifier (UUID) */
  runId: string;
  /** Tenant ID (for multi-tenancy) */
  tenantId: string;
  /** Plugin ID (foreign key to plugins table) */
  pluginId: string;
  /** Job name from plugin.json jobs[] */
  jobName: string;
  /** Execution status */
  status: 'pending' | 'running' | 'success' | 'failed';
  /** Start timestamp */
  startedAt: Date;
  /** Completion timestamp (null if not completed) */
  completedAt: Date | null;
  /** Number of events processed */
  eventsProcessed: number;
  /** Error message (null if successful) */
  errorMessage: string | null;
  /** Metadata (cursor, retryCount, etc.) */
  metadata: PluginRunMetadata | null;
}

/**
 * Run summary statistics
 *
 * Aggregated statistics for all runs of a plugin.
 */
export interface RunSummary {
  /** Total number of runs */
  total: number;
  /** Number of successful runs */
  success: number;
  /** Number of failed runs */
  failed: number;
  /** Number of currently running runs */
  running: number;
  /** Number of pending runs */
  pending: number;
  /** Average events processed per successful run */
  avgEventsProcessed: number;
  /** Average duration (ms) per successful run */
  avgDuration: number;
}

/**
 * Create a new plugin run record (status: 'pending')
 *
 * Creates a run record with status='pending'. The run can be started
 * later by calling startPluginRun().
 *
 * @param tenantId - Tenant ID (required, must be non-empty string)
 * @param pluginId - Plugin ID (UUID)
 * @param jobName - Job name from plugin.json jobs[]
 * @param metadata - Optional metadata (cursor, retryCount, etc.)
 * @returns Run ID (UUID)
 * @throws Error if tenantId is invalid or database insert fails
 *
 * @example
 * ```typescript
 * const runId = await createPluginRun('default', pluginId, 'sync');
 * ```
 */
export async function createPluginRun(
  tenantId: string,
  pluginId: string,
  jobName: string,
  metadata?: PluginRunMetadata
): Promise<string> {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('tenantId is required and must be a non-empty string');
  }

  return await withTenantContext(tenantId, async (tx) => {
    const [run] = await tx
      .insert(schema.pluginRuns)
      .values({
        tenantId,
        pluginId,
        jobName,
        status: 'pending',
        eventsProcessed: 0,
        errorMessage: null,
        metadata: metadata ? (metadata as unknown as Record<string, unknown>) : null,
      })
      .returning({ runId: schema.pluginRuns.runId });

    if (!run) {
      throw new Error('Failed to create plugin run');
    }

    return run.runId;
  });
}

/**
 * Update plugin run status to 'running'
 *
 * Marks a pending run as running. This should be called when
 * the job execution starts.
 *
 * @param tenantId - Tenant ID (derived from request/session context)
 * @param runId - Run ID (UUID)
 * @throws Error if tenantId is invalid or run not found
 *
 * @example
 * ```typescript
 * await startPluginRun('default', runId);
 * ```
 */
export async function startPluginRun(tenantId: string, runId: string): Promise<void> {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('tenantId is required and must be a non-empty string');
  }

  await withTenantContext(tenantId, async (tx) => {
    await tx
      .update(schema.pluginRuns)
      .set({ status: 'running' })
      .where(eq(schema.pluginRuns.runId, runId));
  });
}

/**
 * Update plugin run status to 'success' or 'failed' with results
 *
 * Completes a run by setting the status, completion timestamp,
 * and result metadata.
 *
 * @param tenantId - Tenant ID (derived from request/session context)
 * @param runId - Run ID (UUID)
 * @param result - Completion result (status, eventsProcessed, errorMessage, metadata)
 * @throws Error if tenantId is invalid or run not found
 *
 * @example
 * ```typescript
 * await completePluginRun('default', runId, {
 *   status: 'success',
 *   eventsProcessed: 100,
 *   metadata: { cursor: '2025-10-28T10:00:00Z' }
 * });
 * ```
 */
export async function completePluginRun(
  tenantId: string,
  runId: string,
  result: {
    status: 'success' | 'failed';
    eventsProcessed: number;
    errorMessage?: string;
    metadata?: PluginRunMetadata;
  }
): Promise<void> {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('tenantId is required and must be a non-empty string');
  }

  await withTenantContext(tenantId, async (tx) => {
    await tx
      .update(schema.pluginRuns)
      .set({
        status: result.status,
        completedAt: new Date(),
        eventsProcessed: result.eventsProcessed,
        errorMessage: result.errorMessage ?? null,
        metadata: result.metadata ? (result.metadata as unknown as Record<string, unknown>) : null,
      })
      .where(eq(schema.pluginRuns.runId, runId));
  });
}

/**
 * Get plugin run details
 *
 * Retrieves a single run record by ID.
 *
 * @param tenantId - Tenant ID (for RLS)
 * @param runId - Run ID (UUID)
 * @returns Plugin run details or null if not found
 *
 * @example
 * ```typescript
 * const run = await getPluginRun('default', runId);
 * if (run) {
 *   console.log(`Status: ${run.status}`);
 * }
 * ```
 */
export async function getPluginRun(
  tenantId: string,
  runId: string
): Promise<PluginRun | null> {
  return await withTenantContext(tenantId, async (tx) => {
    const [run] = await tx
      .select()
      .from(schema.pluginRuns)
      .where(
        and(
          eq(schema.pluginRuns.runId, runId),
          eq(schema.pluginRuns.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!run) {
      return null;
    }

    return {
      runId: run.runId,
      tenantId: run.tenantId,
      pluginId: run.pluginId,
      jobName: run.jobName,
      status: run.status as 'pending' | 'running' | 'success' | 'failed',
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      eventsProcessed: run.eventsProcessed,
      errorMessage: run.errorMessage,
      metadata: run.metadata as PluginRunMetadata | null,
    };
  });
}

/**
 * List plugin runs for a plugin (with pagination, filtering)
 *
 * Retrieves a paginated list of runs for a specific plugin.
 * Supports filtering by status and job name.
 *
 * @param tenantId - Tenant ID (for RLS)
 * @param pluginId - Plugin ID (UUID)
 * @param options - Query options (status, jobName, limit, offset, sort)
 * @returns Paginated list of runs and total count
 *
 * @example
 * ```typescript
 * const { runs, total } = await listPluginRuns('default', pluginId, {
 *   status: 'success',
 *   limit: 20,
 *   offset: 0,
 *   sort: 'desc'
 * });
 * ```
 */
export async function listPluginRuns(
  tenantId: string,
  pluginId: string,
  options?: {
    status?: 'pending' | 'running' | 'success' | 'failed';
    jobName?: string;
    limit?: number;
    offset?: number;
    sort?: 'asc' | 'desc';
  }
): Promise<{ runs: PluginRun[]; total: number }> {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('tenantId is required and must be a non-empty string');
  }

  return await withTenantContext(tenantId, async (tx) => {
    const conditions = [
      eq(schema.pluginRuns.pluginId, pluginId),
      eq(schema.pluginRuns.tenantId, tenantId),
    ];

    // Add optional filters
    if (options?.status) {
      conditions.push(eq(schema.pluginRuns.status, options.status));
    }
    if (options?.jobName) {
      conditions.push(eq(schema.pluginRuns.jobName, options.jobName));
    }

    // Execute queries in parallel
    const [runs, countResult] = await Promise.all([
      tx
        .select()
        .from(schema.pluginRuns)
        .where(and(...conditions))
        .orderBy(
          options?.sort === 'asc'
            ? asc(schema.pluginRuns.startedAt)
            : desc(schema.pluginRuns.startedAt)
        )
        .limit(options?.limit ?? 20)
        .offset(options?.offset ?? 0),
      tx
        .select({ count: count() })
        .from(schema.pluginRuns)
        .where(and(...conditions)),
    ]);

    const totalCount = countResult[0]?.count ?? 0;

    return {
      runs: runs.map((run) => ({
        runId: run.runId,
        tenantId: run.tenantId,
        pluginId: run.pluginId,
        jobName: run.jobName,
        status: run.status as 'pending' | 'running' | 'success' | 'failed',
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        eventsProcessed: run.eventsProcessed,
        errorMessage: run.errorMessage,
        metadata: run.metadata as PluginRunMetadata | null,
      })),
      total: totalCount ?? 0,
    };
  });
}

/**
 * Get run summary statistics for a plugin
 *
 * Calculates aggregated statistics for all runs of a plugin.
 * Includes counts by status and averages for successful runs.
 *
 * RunSummary calculation rules:
 * - avgEventsProcessed and avgDuration are calculated ONLY over successful runs
 * - Query: WHERE status = 'success' AND completedAt IS NOT NULL
 * - avgEventsProcessed = SUM(eventsProcessed) / COUNT(*) for successful runs
 * - avgDuration = SUM(EXTRACT(EPOCH FROM (completedAt - startedAt)) * 1000) / COUNT(*) for successful runs
 * - If COUNT(successful runs) = 0, both averages return 0
 * - No caching: values are recomputed on each request
 *
 * @param tenantId - Tenant ID (for RLS)
 * @param pluginId - Plugin ID (UUID)
 * @returns Run summary statistics
 *
 * @example
 * ```typescript
 * const summary = await getRunSummary('default', pluginId);
 * console.log(`Success rate: ${summary.success / summary.total * 100}%`);
 * ```
 */
export async function getRunSummary(
  tenantId: string,
  pluginId: string
): Promise<RunSummary> {
  return await withTenantContext(tenantId, async (tx) => {
    // Get counts by status
    const statusCounts = await tx
      .select({
        status: schema.pluginRuns.status,
        count: count(),
      })
      .from(schema.pluginRuns)
      .where(
        and(
          eq(schema.pluginRuns.pluginId, pluginId),
          eq(schema.pluginRuns.tenantId, tenantId)
        )
      )
      .groupBy(schema.pluginRuns.status);

    // Calculate aggregates for successful runs
    const [successAggregates] = await tx
      .select({
        count: count(),
        sumEvents: sql<number>`SUM(${schema.pluginRuns.eventsProcessed})`,
        avgDuration: sql<number>`AVG(EXTRACT(EPOCH FROM (${schema.pluginRuns.completedAt} - ${schema.pluginRuns.startedAt})) * 1000)`,
      })
      .from(schema.pluginRuns)
      .where(
        and(
          eq(schema.pluginRuns.pluginId, pluginId),
          eq(schema.pluginRuns.tenantId, tenantId),
          eq(schema.pluginRuns.status, 'success'),
          sql`${schema.pluginRuns.completedAt} IS NOT NULL`
        )
      );

    // Build status counts map
    const counts: Record<string, number> = {};
    for (const row of statusCounts) {
      counts[row.status] = Number(row.count);
    }

    const successCount = Number(successAggregates?.count ?? 0);

    return {
      total: Object.values(counts).reduce((sum, c) => sum + c, 0),
      success: counts['success'] ?? 0,
      failed: counts['failed'] ?? 0,
      running: counts['running'] ?? 0,
      pending: counts['pending'] ?? 0,
      avgEventsProcessed:
        successCount > 0
          ? Math.round(Number(successAggregates?.sumEvents ?? 0) / successCount)
          : 0,
      avgDuration:
        successCount > 0 ? Math.round(Number(successAggregates?.avgDuration ?? 0)) : 0,
    };
  });
}

/**
 * Get the last successful run for a job
 *
 * Retrieves the most recent successful run for a specific job.
 * Used to retrieve the last cursor for incremental sync.
 *
 * @param tenantId - Tenant ID (for RLS)
 * @param pluginId - Plugin ID (UUID)
 * @param jobName - Job name from plugin.json jobs[]
 * @returns Last successful run or null if none found
 *
 * @example
 * ```typescript
 * const lastRun = await getLastSuccessfulRun('default', pluginId, 'sync');
 * const cursor = lastRun?.metadata?.cursor;
 * ```
 */
export async function getLastSuccessfulRun(
  tenantId: string,
  pluginId: string,
  jobName: string
): Promise<PluginRun | null> {
  return await withTenantContext(tenantId, async (tx) => {
    const [run] = await tx
      .select()
      .from(schema.pluginRuns)
      .where(
        and(
          eq(schema.pluginRuns.pluginId, pluginId),
          eq(schema.pluginRuns.tenantId, tenantId),
          eq(schema.pluginRuns.jobName, jobName),
          eq(schema.pluginRuns.status, 'success')
        )
      )
      .orderBy(desc(schema.pluginRuns.completedAt))
      .limit(1);

    if (!run) {
      return null;
    }

    return {
      runId: run.runId,
      tenantId: run.tenantId,
      pluginId: run.pluginId,
      jobName: run.jobName,
      status: run.status as 'pending' | 'running' | 'success' | 'failed',
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      eventsProcessed: run.eventsProcessed,
      errorMessage: run.errorMessage,
      metadata: run.metadata as PluginRunMetadata | null,
    };
  });
}
