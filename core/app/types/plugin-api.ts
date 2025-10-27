/**
 * Plugin Management API Type Definitions
 *
 * Shared types for plugin management REST API endpoints.
 * These types define the contract between client and server for plugin operations.
 *
 * API Endpoints:
 * - GET /api/plugins - List all plugins
 * - PUT /api/plugins/:id - Enable plugin
 * - DELETE /api/plugins/:id - Disable plugin
 * - GET /api/plugins/:id - Get plugin details
 * - GET /api/plugins/:id/logs - Get execution logs
 */

/**
 * Plugin summary (list view)
 *
 * Lightweight plugin info for list endpoints.
 * Excludes config to avoid leaking sensitive data.
 */
export interface PluginSummary {
  /** Plugin UUID */
  pluginId: string;

  /** Plugin key (unique identifier, e.g., "slack", "github") */
  key: string;

  /** Plugin display name */
  name: string;

  /** Plugin version (currently unused, defaults to "1.0.0") */
  version: string;

  /** Whether plugin is enabled */
  enabled: boolean;

  /** Installation timestamp (ISO 8601) */
  installedAt: string;

  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/**
 * Plugin information (API response format)
 *
 * Represents a single plugin with its configuration and status.
 * Dates are serialized as ISO 8601 strings in API responses.
 * Used for detail/action responses where config may be needed.
 */
export interface PluginInfo {
  /** Plugin UUID */
  pluginId: string;

  /** Plugin key (unique identifier, e.g., "slack", "github") */
  key: string;

  /** Plugin display name */
  name: string;

  /** Plugin version (currently unused, defaults to "1.0.0") */
  version: string;

  /** Whether plugin is enabled */
  enabled: boolean;

  /** Plugin configuration (JSON, may contain sensitive data) */
  config: unknown;

  /** Installation timestamp (ISO 8601) */
  installedAt: string;

  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/**
 * Plugin list response
 *
 * Response format for GET /api/plugins
 * Uses PluginSummary (without config) for security
 */
export interface PluginListResponse {
  /** Array of installed plugins */
  plugins: PluginSummary[];
}

/**
 * Enable plugin request body
 *
 * Request format for PUT /api/plugins/:id
 */
export interface EnablePluginRequest {
  /** Optional plugin configuration to update */
  config?: unknown;
}

/**
 * Plugin action response
 *
 * Response format for PUT /api/plugins/:id and DELETE /api/plugins/:id
 */
export interface PluginActionResponse {
  /** Success status */
  success: boolean;

  /** Updated plugin info */
  plugin: PluginInfo;
}

/**
 * Plugin hook information
 *
 * Information about a registered hook handler.
 */
export interface PluginHookInfo {
  /** Hook name (e.g., 'after:activity:create') */
  hookName: string;

  /** Priority (lower = higher priority) - currently unused */
  priority: number;
}

/**
 * Plugin job information
 *
 * Information about a registered scheduled job.
 */
export interface PluginJobInfo {
  /** Job name */
  jobName: string;

  /** Cron expression (if recurring) */
  cron?: string;

  /** Last execution timestamp (ISO 8601) */
  lastRun?: string;

  /** Next scheduled execution (ISO 8601) - currently unused */
  nextRun?: string;
}

/**
 * Plugin detail response
 *
 * Response format for GET /api/plugins/:id
 * Includes plugin info, registered hooks, and scheduled jobs.
 */
export interface PluginDetailResponse {
  /** Plugin information */
  plugin: PluginInfo;

  /** Registered hooks */
  hooks: PluginHookInfo[];

  /** Registered jobs */
  jobs: PluginJobInfo[];
}

/**
 * Plugin log entry
 *
 * Represents a single execution log entry for a plugin.
 */
export interface PluginLogEntry {
  /** Run ID (UUID) */
  runId: string;

  /** Hook or job name (trigger in database) */
  hookName: string;

  /** Execution status */
  status: 'running' | 'success' | 'failed';

  /** Start timestamp (ISO 8601) */
  startedAt: string;

  /** Finish timestamp (ISO 8601, null if still running) */
  finishedAt: string | null;

  /** Execution duration in milliseconds (null if still running) */
  duration: number | null;

  /** Error message (if failed, extracted from result JSON) */
  error?: string;

  /** Result data (JSON, if available) */
  result?: unknown;
}

/**
 * Plugin logs response
 *
 * Response format for GET /api/plugins/:id/logs
 * Includes log entries with pagination metadata.
 */
export interface PluginLogsResponse {
  /** Log entries */
  logs: PluginLogEntry[];

  /** Total count (for pagination) */
  total: number;

  /** Pagination info */
  pagination: {
    /** Items per page (1-100) */
    limit: number;
    /** Offset from start (>= 0) */
    offset: number;
    /** Whether more items are available */
    hasMore: boolean;
  };
}

/**
 * API error response
 *
 * Standard error response format for all API endpoints.
 */
export interface ApiErrorResponse {
  /** Error status code (401, 403, 404, 422, 500) */
  status: number;

  /** Human-readable error message */
  message: string;

  /** Error code for client-side handling (optional) */
  code?: string;
}
