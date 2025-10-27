/**
 * Plugin configuration type definitions
 * Based on plugin.json spec from .tmp/plugin.md
 */

/**
 * Plugin basic information
 */
export interface PluginBasicInfo {
  /** Unique plugin identifier */
  id: string;
  /** Display name of the plugin */
  name: string;
  /** Semantic version */
  version: string;
  /** Plugin description */
  description: string;
  /** Vendor/organization name */
  vendor: string;
  /** Homepage URL (optional) */
  homepage?: string;
  /** License identifier (e.g., MIT, Apache-2.0) */
  license: string;
  /** Core compatibility version range */
  compatibility?: {
    /** Minimum supported core version */
    drowlMin?: string;
    /** Maximum supported core version */
    drowlMax?: string;
  };
}

/**
 * Plugin capabilities and permissions
 */
export interface PluginCapabilities {
  /** Data access scopes (e.g., read:activities, write:activities) */
  scopes: string[];
  /** Allowed network destinations (allowlist) */
  network: string[];
  /** Required secret keys */
  secrets: string[];
}

/**
 * Plugin setting field type
 */
export type PluginSettingType =
  | 'text'
  | 'secret'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'toggle'
  | 'url'
  | 'daterange';

/**
 * Plugin setting schema definition
 */
export interface PluginSettingSchema {
  /** Setting key */
  key: string;
  /** Display label */
  label: string;
  /** Input type */
  type: PluginSettingType;
  /** Required flag */
  required?: boolean;
  /** Default value */
  default?: unknown;
  /** Hint text */
  hint?: string;
  /** Validation regex pattern */
  regex?: string;
  /** Minimum value (for number type) */
  min?: number;
  /** Maximum value (for number type) */
  max?: number;
  /** Options (for select/multiselect type) */
  options?: Array<{ value: string; label: string }>;
}

/**
 * Plugin route definition
 */
export interface PluginRoute {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Route path (e.g., /sync, /widgets/:key) */
  path: string;
  /** Authentication type */
  auth: 'plugin' | 'public';
  /** Timeout in seconds */
  timeoutSec: number;
  /** Request schema file path (optional) */
  requestSchema?: string;
  /** Response schema file path (optional) */
  responseSchema?: string;
  /** Idempotent flag */
  idempotent?: boolean;
  /** Verification config (for public auth) */
  verify?: {
    /** Verification type */
    type: string;
    /** Secret key name */
    secretKey: string;
  };
}

/**
 * Plugin menu item definition
 */
export interface PluginMenu {
  /** Menu key */
  key: string;
  /** Display label */
  label: string;
  /** Icon name (from iconify) */
  icon: string;
  /** Route path */
  to: string;
}

/**
 * Plugin widget definition
 */
export interface PluginWidget {
  /** Widget key */
  key: string;
  /** Widget type */
  type: string;
  /** Display title */
  title: string;
  /** Widget schema version */
  version: string;
}

/**
 * Plugin job (cron) definition
 */
export interface PluginJob {
  /** Job name */
  name: string;
  /** Route to call */
  route: string;
  /** Cron expression */
  cron: string;
  /** Timeout in seconds */
  timeoutSec: number;
  /** Concurrency limit */
  concurrency: number;
  /** Retry configuration */
  retry?: {
    /** Maximum retry count */
    max: number;
    /** Backoff seconds array */
    backoffSec: number[];
  };
  /** Cursor configuration */
  cursor?: {
    /** Cursor key name */
    key: string;
    /** TTL in seconds */
    ttlSec: number;
  };
}

/**
 * Rate limit configuration
 */
export interface PluginRateLimits {
  /** Requests per minute */
  perMinute: number;
  /** Burst limit */
  burst: number;
}

/**
 * Internationalization configuration
 */
export interface PluginI18n {
  /** Supported language codes */
  supported: string[];
}

/**
 * Complete plugin configuration information
 */
export interface PluginConfigInfo {
  /** Basic information */
  basicInfo: PluginBasicInfo;
  /** Capabilities and permissions */
  capabilities: PluginCapabilities;
  /** Settings schema */
  settingsSchema: PluginSettingSchema[];
  /** Route definitions */
  routes: PluginRoute[];
  /** Menu items (optional) */
  menus?: PluginMenu[];
  /** Widget definitions (optional) */
  widgets?: PluginWidget[];
  /** Job definitions (optional) */
  jobs?: PluginJob[];
  /** Rate limits (optional) */
  rateLimits?: PluginRateLimits;
  /** i18n configuration (optional) */
  i18n?: PluginI18n;
}

/**
 * Raw plugin.json structure (as stored in file)
 */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  vendor: string;
  homepage?: string;
  license: string;
  compatibility?: {
    drowlMin?: string;
    drowlMax?: string;
  };
  capabilities: PluginCapabilities;
  settingsSchema: PluginSettingSchema[];
  routes: PluginRoute[];
  menus?: PluginMenu[];
  widgets?: PluginWidget[];
  jobs?: PluginJob[];
  rateLimits?: PluginRateLimits;
  i18n?: PluginI18n;
}
