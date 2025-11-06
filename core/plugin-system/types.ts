/**
 * Plugin Manifest Types (plugin.json)
 *
 * Type definitions for the Drowl Plugin Manifest Spec.
 * See .tmp/plugin.md for full specification.
 *
 * Key Concepts:
 * - Declarative configuration for UI, menus, widgets, jobs, and APIs
 * - Security-first with capabilities-based access control
 * - Self-describing for automatic form generation and validation
 */

/**
 * Plugin setting value types
 *
 * These are the types that can be stored in plugin configuration.
 * - text, url, email, textarea → string
 * - number → number
 * - boolean → boolean
 * - select → string
 * - multiselect → string[]
 * - secret → string (encrypted value)
 */
export type PluginSettingValue = string | number | boolean | string[];

/**
 * Plugin configuration values
 *
 * The actual configuration object for a plugin instance.
 * Keys correspond to settingsSchema field keys.
 */
export type PluginConfigValues = Record<string, PluginSettingValue>;

/**
 * Database filter value types
 *
 * Used in widget data source filters and database queries.
 */
export type FilterValue = string | number | boolean | null | string[] | number[];

/**
 * Plugin run result
 *
 * The JSON result returned from a plugin execution (job or hook).
 * Contains arbitrary data returned by the plugin.
 */
export interface PluginRunResult {
  /** Success status */
  success?: boolean;
  /** Result message */
  message?: string;
  /** Number of records processed (for ETL jobs) */
  processed?: number;
  /** Error details (if failed) */
  error?: string;
  /** Arbitrary plugin-specific data */
  data?: Record<string, string | number | boolean | null | Array<string | number | boolean | null>>;
  /** Cursor for incremental sync (optional) */
  cursor?: string | number;
}

/**
 * Structured logging metadata
 *
 * Additional context data for log entries.
 */
export type LogMetadata = Record<string, string | number | boolean | null>;

/**
 * Plugin compatibility range
 */
export interface PluginCompatibility {
  /** Minimum DRM core version (semver) */
  drowlMin: string;
  /** Maximum DRM core version (semver) */
  drowlMax: string;
}

/**
 * Plugin capabilities (security permissions)
 */
export interface PluginCapabilities {
  /** Database access scopes */
  scopes: string[];
  /** Allowed network egress destinations (hostnames) */
  network: string[];
  /** Secret field names (actual values stored in core KMS) */
  secrets: string[];
}

/**
 * Plugin settings schema field
 */
export interface PluginSettingsField {
  /** Field key (unique within plugin) */
  key: string;
  /** Human-readable label */
  label: string;
  /** Field type */
  type: 'text' | 'secret' | 'number' | 'select' | 'multiselect' | 'boolean' | 'url' | 'email' | 'textarea';
  /** Whether field is required */
  required?: boolean;
  /** Default value */
  default?: PluginSettingValue;
  /** Help text */
  help?: string;
  /** Minimum value (for number fields) */
  min?: number;
  /** Maximum value (for number fields) */
  max?: number;
  /** Regular expression validation (for text fields) */
  regex?: string;
  /** Options (for select/multiselect fields) */
  options?: Array<{ value: string; label: string }>;
}

/**
 * Plugin menu item child (Level 2)
 */
export interface PluginMenuItemChild {
  /** Menu key (unique within plugin) */
  key: string;
  /** Menu label */
  label: string;
  /** Icon name (Iconify format, e.g., "mdi:chart-line") */
  icon?: string;
  /** Route path (relative to plugin root) */
  to: string;
  /** Required capabilities (for permission-based visibility) */
  capabilities?: string[];
}

/**
 * Plugin menu item (Level 1)
 */
export interface PluginMenuItem {
  /** Menu key (unique within plugin) */
  key: string;
  /** Menu label */
  label: string;
  /** Icon name (Iconify format, e.g., "mdi:chart-line") */
  icon: string;
  /** Route path (relative to plugin root) */
  to: string;
  /** Display order (optional) */
  order?: number;
  /** Required capabilities (for permission-based visibility) */
  capabilities?: string[];
  /** Children menu items (Level 2 only, no further nesting) */
  children?: PluginMenuItemChild[];
}

/**
 * Plugin widget definition
 */
export interface PluginWidget {
  /** Widget key (unique within plugin) */
  key: string;
  /** Widget type (stat, table, list, timeseries, barchart, pie, funnel, card) */
  type: string;
  /** Widget title */
  title: string;
  /** Widget schema version */
  version: string;
  /** Widget description (optional) */
  description?: string;
}

/**
 * Plugin API route definition
 */
export interface PluginRoute {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Route path (relative to plugin root) */
  path: string;
  /** Authentication requirement */
  auth: 'plugin' | 'public' | 'user';
  /** Timeout in seconds */
  timeoutSec: number;
  /** Whether route is idempotent (for retry safety) */
  idempotent?: boolean;
  /** Request schema reference (optional) */
  requestSchema?: string;
  /** Response schema reference (optional) */
  responseSchema?: string;
  /** Route description (optional) */
  description?: string;
}

/**
 * Plugin job definition (cron scheduling)
 */
export interface PluginJob {
  /** Job name (unique within plugin) */
  name: string;
  /** Route to call (must match a route in routes[]) */
  route: string;
  /** Cron expression (e.g., "0 0 * * *" for daily at midnight) */
  cron: string;
  /** Timeout in seconds */
  timeoutSec: number;
  /** Concurrency limit (number of simultaneous executions allowed) */
  concurrency: number;
  /** Retry configuration (optional) */
  retry?: {
    /** Maximum number of retry attempts */
    max: number;
    /** Backoff delays in seconds (array of delays for each retry) */
    backoffSec: number[];
  };
  /** Cursor configuration (for incremental sync) */
  cursor?: {
    /** Cursor key (for storing checkpoint in Redis) */
    key: string;
    /** TTL in seconds (how long to keep cursor) */
    ttlSec: number;
  };
  /** Job description (optional) */
  description?: string;
}

/**
 * Plugin rate limits
 */
export interface PluginRateLimits {
  /** Requests per minute */
  perMinute: number;
  /** Burst capacity */
  burst: number;
}

/**
 * Plugin i18n configuration
 */
export interface PluginI18n {
  /** Supported language codes (e.g., ["en", "ja"]) */
  supported: string[];
}

/**
 * Plugin manifest (plugin.json)
 *
 * Complete plugin definition including metadata, configuration,
 * UI elements, API routes, and scheduled jobs.
 */
export interface PluginManifest {
  /** Plugin ID (unique identifier) */
  id: string;
  /** Plugin name (human-readable) */
  name: string;
  /** Plugin version (semver) */
  version: string;
  /** Plugin description */
  description: string;
  /** Plugin vendor/author */
  vendor: string;
  /** Plugin homepage URL */
  homepage: string;
  /** Plugin license (e.g., "MIT", "Commercial") */
  license: string;
  /** DRM core compatibility */
  compatibility: PluginCompatibility;
  /** Plugin capabilities (security permissions) */
  capabilities: PluginCapabilities;
  /** Settings schema (for auto-generated config UI) */
  settingsSchema: PluginSettingsField[];
  /** Menu items (for sidebar/navigation) */
  menus: PluginMenuItem[];
  /** Widget definitions (for dashboard) */
  widgets: PluginWidget[];
  /** API routes (server-side endpoints) */
  routes: PluginRoute[];
  /** Scheduled jobs (cron-based execution) */
  jobs: PluginJob[];
  /** Rate limits (per tenant, per plugin, per route) */
  rateLimits: PluginRateLimits;
  /** Internationalization configuration */
  i18n: PluginI18n;
  /**
   * Auto-generate /data page for plugin event collection
   *
   * When set to true, the core will automatically add a "Collected Data" menu item
   * and route to display plugin_events_raw data. This page shows:
   * - List of collected events with status, type, and timestamp
   * - Filtering by status, event type, and date range
   * - Pagination and sorting
   * - Detail modal with JSON viewer and reprocess button
   *
   * Note: If data is true, menus MUST NOT contain a menu item with path "/data".
   * This will cause a validation error.
   */
  data?: boolean;
}

/**
 * Partial plugin manifest (for updates)
 */
export type PartialPluginManifest = Partial<PluginManifest>;

/**
 * Load plugin manifest from file system
 *
 * Reads and parses plugin.json from the plugins directory.
 * Validates required fields and returns typed manifest.
 *
 * @param pluginKey - Plugin key (e.g., "drowl-plugin-test")
 * @returns Parsed plugin manifest
 * @throws Error if plugin.json not found or invalid
 */
export async function loadPluginManifest(pluginKey: string): Promise<PluginManifest> {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  // Resolve plugins directory (workspace root / plugins)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const workspaceRoot = path.resolve(__dirname, '../../');
  const pluginsDir = path.join(workspaceRoot, 'plugins');

  // Construct plugin.json path
  const pluginJsonPath = path.join(pluginsDir, pluginKey, 'plugin.json');

  // Read and parse plugin.json
  const content = await readFile(pluginJsonPath, 'utf-8');
  const manifest = JSON.parse(content) as PluginManifest;

  // Validate required fields
  if (!manifest.id || typeof manifest.id !== 'string') {
    throw new Error(`Invalid plugin.json: missing or invalid "id" field`);
  }

  if (!manifest.name || typeof manifest.name !== 'string') {
    throw new Error(`Invalid plugin.json: missing or invalid "name" field`);
  }

  if (!manifest.version || typeof manifest.version !== 'string') {
    throw new Error(`Invalid plugin.json: missing or invalid "version" field`);
  }

  return manifest;
}
