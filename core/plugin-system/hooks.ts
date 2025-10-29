/**
 * Hook Registry Module
 *
 * Provides extensibility points for plugins to hook into core functionality.
 * Plugins can register handlers that execute before/after entity operations,
 * or on scheduled cron jobs.
 *
 * Key Features:
 * - Thread-safe hook registration using Map data structure
 * - Multiple handlers per hook (executed sequentially)
 * - Fail-safe execution (errors logged but don't prevent other handlers)
 * - Automatic logging to plugin_runs table for monitoring
 * - Tenant isolation via HookContext
 *
 * Architecture:
 * 1. registerHook() - Registers a handler for a specific hook name
 * 2. executeHook() - Executes all registered handlers for a hook
 * 3. unregisterHook() - Removes handlers for a plugin
 * 4. listHooks() - Returns all registered hooks (debugging)
 *
 * Hook Naming Convention:
 * - before:{entity}:{action} (e.g., "before:developer:create")
 * - after:{entity}:{action} (e.g., "after:activity:create")
 * - cron:{schedule} (e.g., "cron:daily", "cron:hourly")
 *
 * Usage Example:
 * ```typescript
 * // In plugin code
 * registerHook('after:activity:create', pluginId, async (ctx, args) => {
 *   await sendSlackNotification(ctx.tenantId, args.activity);
 * });
 *
 * // In core service code
 * await executeHook('after:activity:create', tenantId, { activity });
 * ```
 */

import { createHash } from 'node:crypto';
import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';

/**
 * Hook execution context
 *
 * Provides metadata about the current hook execution, including tenant ID
 * for tenant isolation, plugin ID for traceability, and timestamp for logging.
 */
export interface HookContext {
  /** Tenant ID for RLS and data isolation */
  tenantId: string;
  /** Plugin ID that registered this handler */
  pluginId: string;
  /** Name of the hook being executed */
  hookName: string;
  /** Timestamp when execution started */
  timestamp: Date;
}

/**
 * Hook handler function type
 *
 * Handlers can be synchronous or asynchronous. They receive a context object
 * with metadata and hook-specific arguments.
 *
 * @param ctx - Hook execution context
 * @param args - Hook-specific arguments (type varies by hook)
 * @returns Promise<void> or void
 */
export type HookHandler<T = unknown> = (ctx: HookContext, args: T) => Promise<void> | void;

/**
 * Hook execution result
 *
 * Returned by executeHook() to indicate success/failure and provide
 * error details for failed handlers.
 */
export interface HookExecutionResult {
  /** Overall success (true if all handlers succeeded) */
  success: boolean;
  /** Run ID from plugin_runs table */
  runId: string;
  /** Array of errors from failed handlers */
  errors: Array<{ pluginId: string; error: Error }>;
}

/**
 * Hook execution result record (stored in plugin_runs.result JSONB)
 *
 * Stored in plugin_runs table for monitoring and debugging.
 * Contains execution statistics and error details.
 */
export interface HookExecutionResultRecord {
  /** Hook name that was executed */
  hookName: string;
  /** SHA-256 hash of arguments (for duplicate detection) */
  argsHash: string;
  /** Array of errors from failed handlers */
  errors: Array<{
    pluginId: string;
    errorMessage: string;
    stack?: string;
  }>;
  /** Total number of handlers executed */
  handlerCount: number;
  /** Number of handlers that succeeded */
  successCount: number;
  /** Number of handlers that failed */
  failureCount: number;
}

/**
 * Registered hook handler entry
 *
 * Internal data structure for storing registered handlers.
 */
interface RegisteredHandler {
  /** Plugin ID that registered this handler */
  pluginId: string;
  /** Handler function */
  handler: HookHandler;
}

/**
 * Global hook registry
 *
 * Maps hook names to arrays of registered handlers.
 * Thread-safe (Map operations are atomic in Node.js single-threaded model).
 */
const hookRegistry = new Map<string, RegisteredHandler[]>();

/**
 * Register a hook handler
 *
 * Adds a handler function to the specified hook. Multiple handlers can be
 * registered for the same hook - they will be executed sequentially in
 * registration order.
 *
 * @param hookName - Name of the hook (e.g., "after:activity:create")
 * @param pluginId - UUID of the plugin registering this handler
 * @param handler - Handler function to execute
 *
 * @example
 * ```typescript
 * registerHook('after:activity:create', 'plugin-uuid', async (ctx, args) => {
 *   console.log('Activity created:', args.activity.activityId);
 * });
 * ```
 */
export function registerHook<T = unknown>(
  hookName: string,
  pluginId: string,
  handler: HookHandler<T>
): void {
  // Get existing handlers for this hook, or initialize empty array
  const handlers = hookRegistry.get(hookName) ?? [];

  // Add new handler to the array
  handlers.push({
    pluginId,
    handler: handler as HookHandler, // Type-erase for storage
  });

  // Update registry
  hookRegistry.set(hookName, handlers);
}

/**
 * Execute all registered handlers for a hook
 *
 * Executes handlers sequentially in registration order. If a handler throws
 * an error, it is logged and execution continues with the next handler
 * (fail-safe behavior).
 *
 * All execution details are logged to plugin_runs table for monitoring.
 *
 * @param hookName - Name of the hook to execute
 * @param tenantId - Tenant ID for context and logging
 * @param args - Hook-specific arguments passed to handlers
 * @returns Execution result with success status and error details
 *
 * @example
 * ```typescript
 * const result = await executeHook('after:activity:create', 'default', {
 *   activity: { activityId: '123', ... }
 * });
 * if (!result.success) {
 *   console.error('Some handlers failed:', result.errors);
 * }
 * ```
 */
export async function executeHook<T = unknown>(
  hookName: string,
  tenantId: string,
  args: T
): Promise<HookExecutionResult> {
  // Get registered handlers for this hook
  const handlers = hookRegistry.get(hookName) ?? [];

  // If no handlers registered, return early with empty success result
  if (handlers.length === 0) {
    // System hooks (no handlers) do not create plugin_runs DB records.
    // logHookExecution returns a placeholder runId for monitoring.
    const emptyResult = await logHookExecution(
      hookName,
      tenantId,
      'system', // No specific plugin ID for system hooks
      args,
      [],
      0,
      0
    );
    return {
      success: true,
      runId: emptyResult,
      errors: [],
    };
  }

  // Track errors from failed handlers
  const errors: Array<{ pluginId: string; error: Error }> = [];

  // Execute each handler sequentially
  let successCount = 0;
  for (const { pluginId, handler } of handlers) {
    try {
      // Create execution context
      const ctx: HookContext = {
        tenantId,
        pluginId,
        hookName,
        timestamp: new Date(),
      };

      // Execute handler (await if Promise, otherwise synchronous)
      await handler(ctx, args);

      // Handler succeeded
      successCount++;
    } catch (error) {
      // Handler failed - log error and continue (fail-safe)
      errors.push({
        pluginId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  // Calculate failure count
  const failureCount = handlers.length - successCount;

  // Log execution to plugin_runs table
  // Use first plugin's ID for the run record (or 'system' if all failed)
  const firstHandler = handlers[0];
  if (!firstHandler) {
    // This should never happen since we checked handlers.length > 0
    throw new Error('No handlers found despite length check');
  }
  const primaryPluginId = firstHandler.pluginId;
  const runId = await logHookExecution(
    hookName,
    tenantId,
    primaryPluginId,
    args,
    errors,
    successCount,
    failureCount
  );

  return {
    success: errors.length === 0,
    runId,
    errors,
  };
}

/**
 * Unregister all handlers for a plugin
 *
 * Removes all handlers registered by the specified plugin for the given hook.
 * Used when a plugin is disabled or uninstalled.
 *
 * @param hookName - Name of the hook
 * @param pluginId - UUID of the plugin to unregister
 *
 * @example
 * ```typescript
 * unregisterHook('after:activity:create', 'plugin-uuid');
 * ```
 */
export function unregisterHook(hookName: string, pluginId: string): void {
  const handlers = hookRegistry.get(hookName);
  if (!handlers) {
    return; // No handlers registered for this hook
  }

  // Filter out handlers for this plugin
  const filtered = handlers.filter((h) => h.pluginId !== pluginId);

  if (filtered.length === 0) {
    // No handlers left - remove hook from registry
    hookRegistry.delete(hookName);
  } else {
    // Update registry with filtered handlers
    hookRegistry.set(hookName, filtered);
  }
}

/**
 * List all registered hooks
 *
 * Returns the entire hook registry for debugging and monitoring.
 * Used by admin UI to display active hooks.
 *
 * @returns Map of hook names to registered handlers
 *
 * @example
 * ```typescript
 * const hooks = listHooks();
 * for (const [hookName, handlers] of hooks) {
 *   console.log(`${hookName}: ${handlers.length} handlers`);
 * }
 * ```
 */
export function listHooks(): Map<string, Array<{ pluginId: string; handler: HookHandler }>> {
  return new Map(hookRegistry);
}

/**
 * Stable stringify helper
 *
 * Recursively sorts object keys, handles arrays, null/undefined, and
 * detects circular references. Produces deterministic JSON strings
 * for consistent hashing.
 *
 * @param value - Value to stringify
 * @param seen - WeakSet to track circular references
 * @returns Stable JSON string
 * @private
 */
function stableStringify(value: unknown, seen: WeakSet<object> = new WeakSet()): string {
  // Handle primitives
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'function') return '[Function]';
  if (typeof value === 'symbol') return '[Symbol]';

  // Handle arrays
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item, seen)).join(',')}]`;
  }

  // Handle objects
  if (typeof value === 'object') {
    // Check for circular reference
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);

    // Sort keys and stringify recursively
    const keys = Object.keys(value).sort();
    const pairs = keys.map((key) => {
      const objValue = value as Record<string, unknown>;
      return `${JSON.stringify(key)}:${stableStringify(objValue[key], seen)}`;
    });

    return `{${pairs.join(',')}}`;
  }

  // Fallback for unknown types
  return '[Unknown]';
}

/**
 * Compute SHA-256 hash of arguments for deduplication
 *
 * Used to detect duplicate hook executions with identical arguments.
 * Converts arguments to canonical JSON string via stableStringify
 * (which recursively sorts keys, handles null/undefined, and detects
 * circular references) before computing SHA-256 hash.
 *
 * @param args - Hook arguments to hash
 * @returns Hex-encoded SHA-256 hash
 * @private
 */
function computeArgsHash(args: unknown): string {
  // Convert args to stable JSON string (deterministic for all inputs)
  const argsJson = stableStringify(args);

  // Compute SHA-256 hash
  const hash = createHash('sha256');
  hash.update(argsJson);
  return hash.digest('hex');
}

/**
 * Log hook execution to plugin_runs table
 *
 * Creates a record in plugin_runs with execution details, including
 * status, error information, and execution statistics.
 *
 * @param hookName - Name of the hook executed
 * @param tenantId - Tenant ID for RLS
 * @param pluginId - Plugin ID for the primary handler (or 'system')
 * @param args - Hook arguments (used to compute hash)
 * @param errors - Array of errors from failed handlers
 * @param successCount - Number of successful handlers
 * @param failureCount - Number of failed handlers
 * @returns Run ID (UUID) of the created record
 * @private
 */
async function logHookExecution(
  hookName: string,
  tenantId: string,
  pluginId: string,
  args: unknown,
  errors: Array<{ pluginId: string; error: Error }>,
  successCount: number,
  failureCount: number
): Promise<string> {
  // Compute args hash for deduplication
  const argsHash = computeArgsHash(args);

  // Determine execution status
  let status: 'success' | 'failed' | 'partial';
  if (failureCount === 0) {
    status = 'success';
  } else if (successCount === 0) {
    status = 'failed';
  } else {
    status = 'partial';
  }

  // Build result record
  const result: HookExecutionResultRecord = {
    hookName,
    argsHash,
    errors: errors.map((e) => {
      // Include stack trace only in development
      const errorRecord: {
        pluginId: string;
        errorMessage: string;
        stack?: string;
      } = {
        pluginId: e.pluginId,
        errorMessage: e.error.message,
      };

      // Only add stack property if in development and stack exists
      if (process.env.NODE_ENV === 'development' && e.error.stack) {
        errorRecord.stack = e.error.stack;
      }

      return errorRecord;
    }),
    handlerCount: successCount + failureCount,
    successCount,
    failureCount,
  };

  // Insert into plugin_runs table
  return await withTenantContext(tenantId, async (tx) => {
    // If pluginId is 'system', we need to look up or create a system plugin record
    // For now, we'll skip logging if no plugin exists (system hooks)
    if (pluginId === 'system') {
      // Generate a UUID for the run (we can't insert without a valid plugin_id FK)
      // Skip database insert for system hooks (no handlers registered)
      return '00000000-0000-0000-0000-000000000000';
    }

    const [run] = await tx
      .insert(schema.pluginRuns)
      .values({
        tenantId,
        pluginId,
        jobName: 'hook-execution', // Use generic job name for hooks
        startedAt: new Date(),
        completedAt: new Date(), // Immediate finish for hooks
        status,
        eventsProcessed: 0,
        errorMessage: null,
        metadata: result as unknown as Record<string, unknown>,
      })
      .returning({ runId: schema.pluginRuns.runId });

    if (!run) {
      throw new Error('Failed to insert plugin run record');
    }

    return run.runId;
  });
}
