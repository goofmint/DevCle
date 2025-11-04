/**
 * Plugin configuration service
 * Handles reading and parsing plugin.json files
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  PluginConfigInfo,
  PluginManifest,
  PluginBasicInfo,
} from './plugin-config.types.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get base directory for plugins
 * Can be overridden via PLUGINS_DIR environment variable
 * Default: /workspace/plugins (relative to project root)
 *
 * @returns Absolute path to plugins directory
 */
function getPluginsBaseDir(): string {
  return process.env['PLUGINS_DIR']
    ? path.resolve(process.env['PLUGINS_DIR'])
    : path.resolve(__dirname, '..', '..', '..', 'plugins');
}

/**
 * Get the plugin directory path with path traversal protection
 *
 * @param pluginId - Plugin identifier
 * @returns Absolute path to plugin directory
 * @throws {Error} If pluginId contains path traversal attempts
 */
function getPluginDirectory(pluginId: string): string {
  // Validate pluginId
  if (!pluginId) {
    throw new Error(`Invalid plugin ID: cannot be empty`);
  }

  // Use path.basename to extract only the final component, preventing traversal
  const sanitizedId = path.basename(pluginId);

  // Additional validation: ensure no path separators or dots remain
  if (sanitizedId.includes('..') || sanitizedId.includes('/') || sanitizedId.includes('\\')) {
    throw new Error(`Invalid plugin ID: path traversal detected`);
  }

  // Validate against allowed plugin ID pattern (alphanumeric, hyphens, underscores, dots)
  if (!/^[a-zA-Z0-9._-]+$/.test(sanitizedId)) {
    throw new Error(`Invalid plugin ID: contains disallowed characters`);
  }

  // Build absolute path and verify it's inside plugins base directory
  const pluginsBaseDir = getPluginsBaseDir();
  const resolvedPath = path.resolve(pluginsBaseDir, sanitizedId);
  const normalizedBase = path.resolve(pluginsBaseDir);

  if (!resolvedPath.startsWith(normalizedBase + path.sep) && resolvedPath !== normalizedBase) {
    throw new Error(`Invalid plugin ID: path traversal detected`);
  }

  return resolvedPath;
}

/**
 * Get the plugin.json file path
 *
 * @param pluginId - Plugin identifier
 * @returns Absolute path to plugin.json
 */
function getPluginManifestPath(pluginId: string): string {
  return path.join(getPluginDirectory(pluginId), 'plugin.json');
}

/**
 * Check if a plugin exists
 *
 * @param pluginId - Plugin identifier
 * @returns True if plugin directory and plugin.json exist
 */
export async function pluginExists(pluginId: string): Promise<boolean> {
  try {
    const manifestPath = getPluginManifestPath(pluginId);
    await fs.access(manifestPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and parse plugin.json file
 *
 * @param pluginId - Plugin identifier
 * @returns Parsed plugin manifest
 * @throws {Error} If plugin.json cannot be read or parsed
 */
async function readPluginManifest(pluginId: string): Promise<PluginManifest> {
  const manifestPath = getPluginManifestPath(pluginId);

  try {
    let content = await fs.readFile(manifestPath, 'utf-8');

    // Strip UTF-8 BOM if present
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }

    // Parse JSON with normalized error handling
    let manifest: PluginManifest;
    try {
      manifest = JSON.parse(content) as PluginManifest;
    } catch (parseError) {
      // Normalize parse errors to avoid exposing unstable SyntaxError messages
      throw new Error(
        `Plugin manifest for '${pluginId}' is malformed: invalid JSON format`
      );
    }

    // Use 'name' as 'id' if 'id' is not provided (backward compatibility)
    if (!manifest.id && manifest.name) {
      manifest.id = manifest.name;
    }

    // Validate required fields
    if (!manifest.id || !manifest.name || !manifest.version) {
      throw new Error(
        `Plugin manifest for '${pluginId}' is invalid: missing required fields (id, name, version)`
      );
    }

    return manifest;
  } catch (error) {
    if (error instanceof Error) {
      if ('code' in error && error.code === 'ENOENT') {
        throw new Error(`Plugin not found: ${pluginId}`);
      }
      // Re-throw our normalized errors
      throw error;
    }
    throw new Error(`Failed to read plugin manifest for '${pluginId}': ${String(error)}`);
  }
}

/**
 * Convert plugin manifest to configuration info
 *
 * @param manifest - Raw plugin manifest
 * @returns Structured plugin configuration
 */
function manifestToConfigInfo(manifest: PluginManifest): PluginConfigInfo {
  const basicInfo: PluginBasicInfo = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description || '',
    vendor: manifest.vendor || 'Unknown',
    ...(manifest.homepage !== undefined ? { homepage: manifest.homepage } : {}),
    license: manifest.license || 'UNLICENSED',
    ...(manifest.compatibility !== undefined ? { compatibility: manifest.compatibility } : {}),
  };

  const config: PluginConfigInfo = {
    basicInfo,
    capabilities: manifest.capabilities || {
      scopes: [],
      network: [],
      secrets: [],
    },
    settingsSchema: manifest.settingsSchema || [],
    routes: manifest.routes || [],
    ...(manifest.menus !== undefined ? { menus: manifest.menus } : {}),
    ...(manifest.widgets !== undefined ? { widgets: manifest.widgets } : {}),
    ...(manifest.jobs !== undefined ? { jobs: manifest.jobs } : {}),
    ...(manifest.rateLimits !== undefined ? { rateLimits: manifest.rateLimits } : {}),
    ...(manifest.i18n !== undefined ? { i18n: manifest.i18n } : {}),
  };

  return config;
}

/**
 * Get plugin configuration information
 *
 * @param pluginId - Plugin identifier
 * @param _tenantId - Tenant ID (for future multi-tenancy support)
 * @returns Complete plugin configuration
 * @throws {Error} If plugin is not found or configuration is invalid
 */
export async function getPluginConfig(
  pluginId: string,
  _tenantId: string
): Promise<PluginConfigInfo> {
  // Read and parse plugin.json
  const manifest = await readPluginManifest(pluginId);

  // Convert to structured configuration
  return manifestToConfigInfo(manifest);
}

/**
 * List all available plugins
 *
 * @returns Array of plugin IDs
 */
export async function listAvailablePlugins(): Promise<string[]> {
  try {
    const pluginsBaseDir = getPluginsBaseDir();
    const entries = await fs.readdir(pluginsBaseDir, {
      withFileTypes: true,
    });

    // Filter directories only
    const pluginDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      // Exclude hidden directories
      .filter((name) => !name.startsWith('.'));

    // Filter directories that have plugin.json
    const validPlugins: string[] = [];
    for (const dir of pluginDirs) {
      if (await pluginExists(dir)) {
        validPlugins.push(dir);
      }
    }

    return validPlugins;
  } catch {
    return [];
  }
}
