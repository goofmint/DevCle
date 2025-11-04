/**
 * Plugin Context Module
 *
 * Provides context creation for plugin execution.
 * Context includes database access, scheduler, hooks, and logging.
 *
 * Key Features:
 * - Database access with RLS (tenant-scoped)
 * - Job scheduler for background tasks
 * - Hook registry for event hooks
 * - Logger for structured logging
 *
 * Usage Example:
 * ```typescript
 * const ctx = createPluginContext('plugin-id', 'default');
 * ctx.logger.info('Plugin loaded');
 * await ctx.scheduler.registerJob(...);
 * ```
 */

import { getDb } from '../db/connection.js';
import { getScheduler } from './scheduler.js';
import type { JobScheduler } from './scheduler.js';
import * as schema from '../db/schema/index.js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { LogMetadata } from './types.js';

/**
 * Plugin execution context
 *
 * Provides all necessary resources for plugin execution:
 * - Database access (tenant-scoped via RLS)
 * - Job scheduler for background tasks
 * - Hooks registry for event hooks
 * - Logger for structured logging
 */
export interface PluginContext {
  /** Plugin ID (UUID) */
  pluginId: string;

  /** Tenant ID for RLS and data isolation */
  tenantId: string;

  /** Database instance (Drizzle ORM) */
  db: PostgresJsDatabase<typeof schema>;

  /** Job scheduler for background tasks */
  scheduler: JobScheduler;

  /** Logger for structured logging */
  logger: PluginLogger;
}

/**
 * Plugin logger interface
 *
 * Provides structured logging with metadata support.
 * Logs are written to stdout in JSON format.
 */
export interface PluginLogger {
  /**
   * Log informational message
   *
   * @param message - Log message
   * @param meta - Additional metadata (optional)
   */
  info: (message: string, meta?: LogMetadata) => void;

  /**
   * Log error message
   *
   * @param message - Error message
   * @param error - Error object (optional)
   * @param meta - Additional metadata (optional)
   */
  error: (message: string, error?: Error, meta?: LogMetadata) => void;

  /**
   * Log warning message
   *
   * @param message - Warning message
   * @param meta - Additional metadata (optional)
   */
  warn: (message: string, meta?: LogMetadata) => void;

  /**
   * Log debug message
   *
   * @param message - Debug message
   * @param meta - Additional metadata (optional)
   */
  debug: (message: string, meta?: LogMetadata) => void;
}

/**
 * Create plugin execution context
 *
 * Creates a context object with all resources needed for plugin execution.
 * Context is scoped to a specific plugin and tenant.
 *
 * @param pluginId - Plugin identifier (UUID)
 * @param tenantId - Tenant identifier for RLS
 *
 * @returns Plugin context object
 *
 * @example
 * ```typescript
 * const ctx = createPluginContext(
 *   '123e4567-e89b-12d3-a456-426614174000',
 *   'default'
 * );
 *
 * ctx.logger.info('Plugin initialized');
 * await ctx.scheduler.registerJob(...);
 * ```
 */
export function createPluginContext(
  pluginId: string,
  tenantId: string
): PluginContext {
  return {
    pluginId,
    tenantId,
    db: getDb(),
    scheduler: getScheduler(),
    logger: createLogger(pluginId, tenantId),
  };
}

/**
 * Create a logger instance for a plugin
 *
 * Creates a structured logger that outputs JSON-formatted logs
 * with plugin and tenant context.
 *
 * @param pluginId - Plugin identifier
 * @param tenantId - Tenant identifier
 *
 * @returns Logger instance
 *
 * @private
 */
function createLogger(pluginId: string, tenantId: string): PluginLogger {
  // Base log context (without timestamp - generated per log call)
  const baseContext = {
    pluginId,
    tenantId,
  };

  return {
    info: (message: string, meta?: LogMetadata) => {
      console.log(
        JSON.stringify({
          ...baseContext,
          level: 'info',
          message,
          meta,
          timestamp: new Date().toISOString(),
        })
      );
    },

    error: (message: string, error?: Error, meta?: LogMetadata) => {
      console.error(
        JSON.stringify({
          ...baseContext,
          level: 'error',
          message,
          error: error
            ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
              }
            : undefined,
          meta,
          timestamp: new Date().toISOString(),
        })
      );
    },

    warn: (message: string, meta?: LogMetadata) => {
      console.warn(
        JSON.stringify({
          ...baseContext,
          level: 'warn',
          message,
          meta,
          timestamp: new Date().toISOString(),
        })
      );
    },

    debug: (message: string, meta?: LogMetadata) => {
      // Only log debug messages in development
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        console.debug(
          JSON.stringify({
            ...baseContext,
            level: 'debug',
            message,
            meta,
            timestamp: new Date().toISOString(),
          })
        );
      }
    },
  };
}
