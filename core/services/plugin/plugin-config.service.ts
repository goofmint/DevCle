/**
 * Plugin configuration service
 * Handles reading and parsing plugin.json files
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  PluginConfigInfo,
  PluginManifest,
  PluginBasicInfo,
} from './plugin-config.types.js';

/**
 * Base directory for plugins
 * Plugins are located in /workspace/plugins directory
 */
const PLUGINS_BASE_DIR = path.resolve(process.cwd(), '..', 'plugins');

/**
 * Get the plugin directory path
 *
 * @param pluginId - Plugin identifier
 * @returns Absolute path to plugin directory
 */
function getPluginDirectory(pluginId: string): string {
  return path.join(PLUGINS_BASE_DIR, pluginId);
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
    const content = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(content) as PluginManifest;

    // Use 'name' as 'id' if 'id' is not provided (backward compatibility)
    if (!manifest.id && manifest.name) {
      manifest.id = manifest.name;
    }

    // Validate required fields
    if (!manifest.id || !manifest.name || !manifest.version) {
      throw new Error(
        'Invalid plugin.json: missing required fields (id, name, version)'
      );
    }

    return manifest;
  } catch (error) {
    if (error instanceof Error) {
      if ('code' in error && error.code === 'ENOENT') {
        throw new Error(`Plugin not found: ${pluginId}`);
      }
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid plugin.json format: ${error.message}`);
      }
      throw error;
    }
    throw new Error(`Failed to read plugin manifest: ${String(error)}`);
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
    homepage: manifest.homepage !== undefined ? manifest.homepage : undefined,
    license: manifest.license || 'UNLICENSED',
    compatibility: manifest.compatibility !== undefined ? manifest.compatibility : undefined,
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
    menus: manifest.menus !== undefined ? manifest.menus : undefined,
    widgets: manifest.widgets !== undefined ? manifest.widgets : undefined,
    jobs: manifest.jobs !== undefined ? manifest.jobs : undefined,
    rateLimits: manifest.rateLimits !== undefined ? manifest.rateLimits : undefined,
    i18n: manifest.i18n !== undefined ? manifest.i18n : undefined,
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
    const entries = await fs.readdir(PLUGINS_BASE_DIR, {
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
