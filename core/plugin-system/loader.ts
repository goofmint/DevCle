import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

// Compute workspace root from import.meta.url (ESM compatibility)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '../../');

/**
 * Validate npm package name to prevent path traversal attacks
 *
 * Enforces npm package name grammar:
 * - No path separators (/, \)
 * - No parent directory references (..)
 * - Allowed characters: lowercase letters, numbers, hyphens, underscores, dots
 * - Optional scoped names (@scope/package)
 *
 * @param packageName - Package name to validate
 * @throws Error if package name is invalid
 * @private
 */
function validatePackageName(packageName: string): void {
  // Check for path separators
  if (packageName.includes('/') && !packageName.startsWith('@')) {
    throw new Error(
      `Invalid plugin name: "${packageName}". Package names cannot contain path separators.`
    );
  }

  if (packageName.includes('\\')) {
    throw new Error(
      `Invalid plugin name: "${packageName}". Package names cannot contain backslashes.`
    );
  }

  // Check for parent directory references
  if (packageName.includes('..')) {
    throw new Error(
      `Invalid plugin name: "${packageName}". Package names cannot contain ".."`
    );
  }

  // Check for scoped packages (@scope/package format)
  const scopedPackageRegex = /^@[a-z0-9-_]+\/[a-z0-9-_]+$/;
  const normalPackageRegex = /^[a-z0-9-_]+$/;

  if (packageName.startsWith('@')) {
    if (!scopedPackageRegex.test(packageName)) {
      throw new Error(
        `Invalid scoped plugin name: "${packageName}". Must follow @scope/package format with lowercase letters, numbers, hyphens, and underscores only.`
      );
    }
  } else {
    if (!normalPackageRegex.test(packageName)) {
      throw new Error(
        `Invalid plugin name: "${packageName}". Must contain only lowercase letters, numbers, hyphens, and underscores.`
      );
    }
  }
}

/**
 * Verify that a resolved path is contained within an expected base directory
 *
 * Prevents path traversal by ensuring the resolved absolute path
 * does not escape the base directory.
 *
 * @param resolvedPath - Absolute path to verify
 * @param baseDir - Expected base directory
 * @throws Error if path escapes base directory
 * @private
 */
function verifyPathInDirectory(
  resolvedPath: string,
  baseDir: string
): void {
  const relativePath = path.relative(baseDir, resolvedPath);

  // Check if path escapes (starts with ..)
  if (relativePath.startsWith('..')) {
    throw new Error(
      `Security violation: Plugin path "${resolvedPath}" escapes base directory "${baseDir}"`
    );
  }

  // Check if path is absolute (indicates escape attempt)
  if (path.isAbsolute(relativePath)) {
    throw new Error(
      `Security violation: Plugin path "${resolvedPath}" is not relative to base directory "${baseDir}"`
    );
  }
}

/**
 * Plugin metadata structure extracted from plugin.json
 *
 * This interface defines the shape of metadata that describes a plugin's
 * identity, version, and DRM-specific configuration.
 */
export interface PluginMetadata {
  /**
   * Plugin package name (e.g., "drowl-plugin-google-analytics")
   * Must start with "drowl-plugin-" prefix for OSS plugins
   */
  name: string;

  /**
   * Plugin version in semver format (e.g., "1.0.0")
   */
  version: string;

  /**
   * Human-readable display name for UI presentation
   */
  displayName: string;

  /**
   * Plugin description explaining its purpose and functionality
   */
  description: string;

  /**
   * Plugin author information (optional)
   */
  author?: string;

  /**
   * Plugin license identifier (e.g., "MIT", "Commercial")
   */
  license?: string;

  /**
   * Plugin entry point file path (optional, defaults to "index.js")
   */
  main?: string;

  /**
   * DRM-specific plugin configuration (optional)
   */
  drm?: {
    /**
     * Plugin type/category (e.g., "analytics", "crm", "notification")
     */
    type?: string;

    /**
     * Required DRM core version in semver range format (e.g., "^0.1.0")
     */
    coreVersion?: string;
  };
}

/**
 * Loaded plugin instance containing metadata and module reference
 *
 * This interface represents a fully loaded plugin with both its
 * metadata and the actual module code ready for execution.
 */
export interface LoadedPlugin {
  /**
   * Plugin metadata extracted from plugin.json
   */
  metadata: PluginMetadata;

  /**
   * Loaded plugin module (ESM default export)
   * Type is intentionally flexible to support various plugin architectures
   */
  module: unknown;

  /**
   * Absolute path to the plugin's plugin.json file
   * Useful for debugging and tracking plugin source location
   */
  pluginJsonPath: string;
}

/**
 * Discover all available DRM plugins
 *
 * This function scans for plugins in two locations:
 * 1. OSS plugins: Read from workspace package.json dependencies (drowl-plugin-* prefix)
 * 2. Cloud plugins: Scan /var/lib/drm/cloud-plugins/ directory (production only)
 *
 * @returns Array of discovered plugin metadata, sorted by plugin name
 *
 * @example
 * ```typescript
 * const plugins = await discoverPlugins();
 * console.log(`Found ${plugins.length} plugins`);
 * plugins.forEach(p => console.log(`- ${p.name} v${p.version}`));
 * ```
 */
export async function discoverPlugins(): Promise<PluginMetadata[]> {
  const plugins: PluginMetadata[] = [];

  // Discover OSS plugins from workspace package.json
  const ossPlugins = await discoverOSSPlugins();
  plugins.push(...ossPlugins);

  // Discover cloud plugins (production only)
  if (process.env.NODE_ENV === 'production') {
    const cloudPlugins = await discoverCloudPlugins();
    plugins.push(...cloudPlugins);
  }

  // Sort plugins by name for consistent ordering
  return plugins.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Discover OSS plugins from workspace package.json
 *
 * Reads the workspace root package.json and filters dependencies
 * that start with "drowl-plugin-" prefix.
 *
 * @returns Array of OSS plugin metadata
 * @private
 */
async function discoverOSSPlugins(): Promise<PluginMetadata[]> {
  const plugins: PluginMetadata[] = [];

  try {
    // Read workspace root package.json
    const packageJsonPath = path.join(WORKSPACE_ROOT, 'package.json');

    if (!existsSync(packageJsonPath)) {
      // No package.json found, return empty array
      return plugins;
    }

    const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    // Extract all dependencies (both prod and dev)
    const allDependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Filter plugins by naming convention (drowl-plugin-* prefix)
    const pluginNames = Object.keys(allDependencies).filter(
      (name) =>
        name.startsWith('drowl-plugin-') ||
        name.startsWith('drowl-plugin-cloud-')
    );

    // Load metadata for each discovered plugin
    for (const pluginName of pluginNames) {
      try {
        // Resolve plugin.json path in node_modules
        const pluginDir = path.join(WORKSPACE_ROOT, 'node_modules', pluginName);
        const pluginJsonPath = path.join(pluginDir, 'plugin.json');

        if (!existsSync(pluginJsonPath)) {
          // Skip if plugin.json doesn't exist
          continue;
        }

        const metadata = await getPluginMetadata(pluginJsonPath);
        plugins.push(metadata);
      } catch (error) {
        // Skip plugins with invalid metadata
        // Production code should log this error for monitoring
        console.warn(`Failed to load plugin metadata for ${pluginName}:`, error);
      }
    }
  } catch (error) {
    // If package.json parsing fails, return empty array
    // Production code should log this error
    console.warn('Failed to discover OSS plugins:', error);
  }

  return plugins;
}

/**
 * Discover cloud plugins from /var/lib/drm/cloud-plugins/
 *
 * Scans the cloud plugins directory for plugin packages and
 * loads their metadata from plugin.json files.
 *
 * @returns Array of cloud plugin metadata
 * @private
 */
async function discoverCloudPlugins(): Promise<PluginMetadata[]> {
  const plugins: PluginMetadata[] = [];
  const cloudPluginsDir = '/var/lib/drm/cloud-plugins';

  try {
    // Check if cloud plugins directory exists
    if (!existsSync(cloudPluginsDir)) {
      return plugins;
    }

    // Read all entries in cloud plugins directory
    const entries = await readdir(cloudPluginsDir, { withFileTypes: true });

    // Filter directories that start with drowl-plugin-cloud-
    const pluginDirs = entries.filter(
      (entry) =>
        entry.isDirectory() && entry.name.startsWith('drowl-plugin-cloud-')
    );

    // Load metadata for each cloud plugin
    for (const pluginDir of pluginDirs) {
      try {
        const pluginJsonPath = path.join(
          cloudPluginsDir,
          pluginDir.name,
          'plugin.json'
        );

        if (!existsSync(pluginJsonPath)) {
          continue;
        }

        const metadata = await getPluginMetadata(pluginJsonPath);
        plugins.push(metadata);
      } catch (error) {
        console.warn(
          `Failed to load cloud plugin metadata for ${pluginDir.name}:`,
          error
        );
      }
    }
  } catch (error) {
    console.warn('Failed to discover cloud plugins:', error);
  }

  return plugins;
}

/**
 * Load a specific plugin by package name
 *
 * This function resolves the plugin location, loads its metadata,
 * and dynamically imports the plugin module code.
 *
 * @param packageName - Plugin package name (e.g., "drowl-plugin-google-analytics")
 * @returns Loaded plugin with metadata and module reference
 * @throws Error if plugin not found, metadata invalid, or module loading fails
 *
 * @example
 * ```typescript
 * const plugin = await loadPlugin('drowl-plugin-google-analytics');
 * console.log(`Loaded ${plugin.metadata.displayName}`);
 * ```
 */
export async function loadPlugin(packageName: string): Promise<LoadedPlugin> {
  // Validate plugin name format and security
  validatePackageName(packageName);

  if (
    !packageName.startsWith('drowl-plugin-') &&
    !packageName.startsWith('drowl-plugin-cloud-')
  ) {
    throw new Error(
      `Invalid plugin name: ${packageName}. Plugin names must start with "drowl-plugin-" or "drowl-plugin-cloud-"`
    );
  }

  // Resolve plugin.json path
  const pluginJsonPath = resolvePluginJsonPath(packageName);

  if (!existsSync(pluginJsonPath)) {
    throw new Error(
      `Plugin "${packageName}" not found: plugin.json missing at ${pluginJsonPath}`
    );
  }

  // Load plugin metadata
  const metadata = await getPluginMetadata(pluginJsonPath);

  // Resolve plugin module entry point (security: prevent directory traversal)
  const pluginDir = path.dirname(pluginJsonPath);

  // Only allow relative paths in main field
  const mainField = metadata.main || 'index.js';
  if (path.isAbsolute(mainField)) {
    throw new Error(
      `Security violation: Plugin main field cannot be an absolute path: ${mainField}`
    );
  }

  const pluginModulePath = path.resolve(pluginDir, mainField);

  // Verify the resolved module path is within the plugin directory
  verifyPathInDirectory(pluginModulePath, pluginDir);

  if (!existsSync(pluginModulePath)) {
    throw new Error(
      `Plugin module not found: ${pluginModulePath} (specified in plugin.json "main" field)`
    );
  }

  // Dynamically import plugin module using file URL (ESM compatibility and security)
  let module: unknown;
  try {
    const moduleUrl = pathToFileURL(pluginModulePath).href;
    const importedModule = await import(moduleUrl);
    module = importedModule.default || importedModule;
  } catch (error) {
    throw new Error(
      `Failed to load plugin module "${packageName}": ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return {
    metadata,
    module,
    pluginJsonPath,
  };
}

/**
 * Resolve plugin.json path for a given package name
 *
 * Checks both node_modules and cloud plugins directory.
 *
 * @param packageName - Plugin package name
 * @returns Absolute path to plugin.json
 * @private
 */
function resolvePluginJsonPath(packageName: string): string {
  // Validate package name before any path operations
  validatePackageName(packageName);

  // Check node_modules first (OSS plugins)
  const ossPath = path.join(
    WORKSPACE_ROOT,
    'node_modules',
    packageName,
    'plugin.json'
  );

  if (existsSync(ossPath)) {
    // Verify the resolved path is within node_modules
    const nodeModulesDir = path.join(WORKSPACE_ROOT, 'node_modules');
    verifyPathInDirectory(ossPath, nodeModulesDir);
    return ossPath;
  }

  // Check cloud plugins directory (production only)
  if (process.env.NODE_ENV === 'production') {
    const cloudPluginsDir = '/var/lib/drm/cloud-plugins';
    const cloudPath = path.join(cloudPluginsDir, packageName, 'plugin.json');

    if (existsSync(cloudPath)) {
      // Verify the resolved path is within cloud plugins directory
      verifyPathInDirectory(cloudPath, cloudPluginsDir);
      return cloudPath;
    }
  }

  // Return OSS path as default (will be checked by caller)
  return ossPath;
}

/**
 * Get plugin metadata from plugin.json file
 *
 * Reads and parses plugin.json, validates required fields,
 * and extracts plugin metadata.
 *
 * @param pluginJsonPath - Absolute path to plugin.json
 * @returns Plugin metadata
 * @throws Error if file doesn't exist, JSON is invalid, or required fields are missing
 *
 * @example
 * ```typescript
 * const metadata = await getPluginMetadata('/path/to/plugin.json');
 * console.log(`Plugin: ${metadata.name} v${metadata.version}`);
 * ```
 */
export async function getPluginMetadata(
  pluginJsonPath: string
): Promise<PluginMetadata> {
  // Validate path is absolute (security: prevent path traversal)
  if (!path.isAbsolute(pluginJsonPath)) {
    throw new Error(
      `Plugin JSON path must be absolute, got: ${pluginJsonPath}`
    );
  }

  // Read plugin.json file
  let pluginJsonContent: string;
  try {
    pluginJsonContent = await readFile(pluginJsonPath, 'utf-8');
  } catch (error) {
    throw new Error(
      `Failed to read plugin.json at ${pluginJsonPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Parse JSON
  let pluginJson: Record<string, unknown>;
  try {
    pluginJson = JSON.parse(pluginJsonContent) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `Invalid JSON in plugin.json at ${pluginJsonPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Validate required fields
  if (typeof pluginJson['name'] !== 'string' || !pluginJson['name']) {
    throw new Error(
      `Missing or invalid "name" field in plugin.json at ${pluginJsonPath}`
    );
  }

  if (typeof pluginJson['version'] !== 'string' || !pluginJson['version']) {
    throw new Error(
      `Missing or invalid "version" field in plugin.json at ${pluginJsonPath}`
    );
  }

  // Extract metadata with type safety
  const metadata: PluginMetadata = {
    name: pluginJson['name'],
    version: pluginJson['version'],
    displayName:
      typeof pluginJson['displayName'] === 'string'
        ? pluginJson['displayName']
        : pluginJson['name'],
    description:
      typeof pluginJson['description'] === 'string'
        ? pluginJson['description']
        : '',
  };

  // Add optional fields only if they exist (exactOptionalPropertyTypes)
  if (typeof pluginJson['author'] === 'string') {
    metadata.author = pluginJson['author'];
  }

  if (typeof pluginJson['license'] === 'string') {
    metadata.license = pluginJson['license'];
  }

  // Add main field for module resolution
  if (typeof pluginJson['main'] === 'string') {
    metadata.main = pluginJson['main'];
  }

  // Extract DRM-specific configuration if present
  if (
    typeof pluginJson['drm'] === 'object' &&
    pluginJson['drm'] !== null &&
    !Array.isArray(pluginJson['drm'])
  ) {
    const drmConfig = pluginJson['drm'] as Record<string, unknown>;
    const drmMetadata: { type?: string; coreVersion?: string } = {};

    if (typeof drmConfig['type'] === 'string') {
      drmMetadata.type = drmConfig['type'];
    }

    if (typeof drmConfig['coreVersion'] === 'string') {
      drmMetadata.coreVersion = drmConfig['coreVersion'];
    }

    metadata.drm = drmMetadata;
  }

  return metadata;
}
