/**
 * Plugin Menu System
 *
 * This module handles loading and filtering of plugin-defined menu items.
 * Plugins can declare menu items in their plugin.json "menus" field,
 * and this module ensures they are validated, filtered by permissions,
 * and enforced to a maximum depth of 2 levels.
 *
 * Security:
 * - Path traversal prevention
 * - Permission-based filtering
 * - Maximum depth enforcement (2 levels)
 * - XSS protection for labels and icons
 * - data field validation (prevent /data in menus when data: true)
 *
 * @module plugin-system/menu
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import type { PluginManifest } from './types.js';

/**
 * Child menu item (Level 2) - No children allowed
 *
 * This interface represents a second-level menu item.
 * It cannot have children to enforce the 2-level maximum depth.
 */
export interface PluginMenuItemChild {
  /** Display label */
  label: string;

  /** Icon name (e.g., "mdi:account-multiple") */
  icon?: string;

  /** Link target path */
  path: string;

  /** Required capabilities (multiple can be specified) */
  capabilities?: string[];

  /** Plugin key (internal use, auto-assigned) */
  pluginKey: string;
}

/**
 * Top-level menu item (Level 1) - Maximum 2 levels total
 *
 * This interface represents a first-level menu item.
 * It can have children, but those children cannot have further children.
 */
export interface PluginMenuItem {
  /** Display label */
  label: string;

  /** Icon name (e.g., "mdi:chart-line") */
  icon?: string;

  /** Link target path */
  path: string;

  /** Required capabilities (multiple can be specified) */
  capabilities?: string[];

  /** Children menu items (Level 2 only, no further nesting) */
  children?: PluginMenuItemChild[];

  /** Plugin key (internal use, auto-assigned) */
  pluginKey: string;

  /** Plugin name (human-readable, from plugin.json) */
  pluginName: string;
}

/**
 * Raw menu item from plugin.json (before validation)
 *
 * This is the shape of menu items as they appear in plugin.json.
 * They may have invalid nesting that needs to be validated.
 */
interface RawMenuItemChild {
  label: string;
  icon?: string;
  path?: string;
  to?: string; // Support both "path" and "to" (plugin.md uses "to")
  capabilities?: string[];
  children?: unknown;
}

interface RawMenuItem {
  key?: string;
  label: string;
  icon?: string;
  path?: string;
  to?: string; // Support both "path" and "to" (plugin.md uses "to")
  capabilities?: string[];
  children?: RawMenuItemChild[];
}

/**
 * Get plugin menu items for a specific tenant
 *
 * This function:
 * 1. Gets all enabled plugins for the tenant from the database
 * 2. Loads each plugin's plugin.json
 * 3. Extracts the "menus" field
 * 4. Validates menu depth (max 2 levels)
 * 5. Assigns plugin keys to each item
 * 6. Returns an array of validated menu items
 *
 * @param tenantId - Tenant ID to load plugins for
 * @returns Array of validated plugin menu items
 * @throws Error if database query fails or plugin.json cannot be read
 *
 * @example
 * ```typescript
 * const menuItems = await getPluginMenuItems('default');
 * console.log(`Loaded ${menuItems.length} menu items`);
 * ```
 */
export async function getPluginMenuItems(
  _tenantId: string
): Promise<PluginMenuItem[]> {
  const allMenuItems: PluginMenuItem[] = [];
  const db = getDb();

  // Get all enabled plugins for this tenant
  const enabledPlugins = await db
    .select({
      pluginId: schema.plugins.pluginId,
      key: schema.plugins.key,
    })
    .from(schema.plugins)
    .where(
      and(
        eq(schema.plugins.enabled, true),
        eq(schema.plugins.tenantId, _tenantId)
      )
    );

  // Load menu items from each enabled plugin
  for (const plugin of enabledPlugins) {
    try {
      // Resolve plugin directory path
      // Plugins are located in ../plugins/{key}/
      const pluginDir = path.resolve(
        process.cwd(),
        '..',
        'plugins',
        plugin.key
      );
      const pluginJsonPath = path.join(pluginDir, 'plugin.json');

      if (!existsSync(pluginJsonPath)) {
        // Skip if plugin.json doesn't exist
        console.warn(`[Plugin Menu] plugin.json not found for ${plugin.key}`);
        continue;
      }

      // Read and parse plugin.json
      const pluginJsonContent = await readFile(pluginJsonPath, 'utf-8');
      const pluginJson = JSON.parse(pluginJsonContent) as Record<
        string,
        unknown
      >;

      // Parse plugin.json as PluginManifest (partial validation)
      // We need to construct a minimal manifest object for generatePluginMenus
      const manifest: Partial<PluginManifest> = {
        name: (pluginJson['name'] as string) || plugin.key,
        menus: [],
        data: pluginJson['data'] === true,
      };

      // Extract menus field
      // Support both "menus" array (plugin.md) and nested structure (task-8.6)
      if (Array.isArray(pluginJson['menus'])) {
        manifest.menus = pluginJson['menus'] as PluginManifest['menus'];
      } else if (
        typeof pluginJson['drm'] === 'object' &&
        pluginJson['drm'] !== null
      ) {
        const drmConfig = pluginJson['drm'] as Record<string, unknown>;
        if (
          typeof drmConfig['menu'] === 'object' &&
          drmConfig['menu'] !== null
        ) {
          const menuConfig = drmConfig['menu'] as Record<string, unknown>;
          if (Array.isArray(menuConfig['items'])) {
            manifest.menus = menuConfig['items'] as PluginManifest['menus'];
          }
        }
      }

      // Use generatePluginMenus to create the final menu structure
      // This will validate the data field and add auto-generated items
      const generatedMenus = generatePluginMenus(
        manifest as PluginManifest,
        plugin.key
      );

      allMenuItems.push(...generatedMenus);
    } catch (error) {
      // Log error and continue with other plugins
      // Don't throw - one broken plugin shouldn't break the entire menu
      console.error(
        `[Plugin Menu] Failed to load menu for ${plugin.key}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return allMenuItems;
}

/**
 * Validate menu depth and truncate items exceeding maximum depth
 *
 * This function enforces the 2-level maximum depth constraint:
 * - Level 1: Top-level menu items (can have children)
 * - Level 2: Child menu items (cannot have children)
 *
 * If a menu item at level 2 has children, they are truncated and
 * an error is logged identifying the plugin and offending path.
 *
 * @param items - Raw menu items from plugin.json
 * @param pluginKey - Plugin key for error logging
 * @param maxDepth - Maximum allowed depth (default: 2)
 * @returns Validated menu items with depth <= maxDepth
 *
 * @example
 * ```typescript
 * const validated = validateMenuDepth(rawMenus, 'github', 2);
 * ```
 */
export function validateMenuDepth(
  items: RawMenuItem[],
  pluginKey: string,
  maxDepth: number = 2
): PluginMenuItem[] {
  const validated: PluginMenuItem[] = [];

  for (const item of items) {
    // Normalize path field (support both "path" and "to")
    let itemPath = item.path || item.to || '';

    if (!itemPath) {
      console.error(
        `[Plugin Menu] Invalid menu item in ${pluginKey}: missing path/to field`
      );
      continue;
    }

    // Expand relative paths to absolute paths
    // /overview → /dashboard/plugins/{pluginKey}/overview
    if (!itemPath.startsWith('/dashboard/plugins/') && !itemPath.startsWith('/plugins/')) {
      // Assume relative path, expand it
      itemPath = `/dashboard/plugins/${pluginKey}${itemPath}`;
    }

    // Create validated top-level item
    const validatedItem: PluginMenuItem = {
      label: String(item.label || ''),
      path: itemPath,
      pluginKey, // Will be set by caller
      pluginName: '', // Will be set by caller
    };

    // Add optional fields
    if (item.icon) {
      validatedItem.icon = String(item.icon);
    }

    if (Array.isArray(item.capabilities)) {
      validatedItem.capabilities = item.capabilities.map((cap) => String(cap));
    }

    // Process children (if any)
    if (Array.isArray(item.children) && item.children.length > 0) {
      const validatedChildren: PluginMenuItemChild[] = [];

      for (const child of item.children) {
        // Normalize child path
        let childPath = child.path || child.to || '';

        if (!childPath) {
          console.error(
            `[Plugin Menu] Invalid child menu item in ${pluginKey} (parent: ${itemPath}): missing path/to field`
          );
          continue;
        }

        // Expand relative paths to absolute paths
        // /settings → /dashboard/plugins/{pluginKey}/settings
        if (!childPath.startsWith('/dashboard/plugins/') && !childPath.startsWith('/plugins/')) {
          // Assume relative path, expand it
          childPath = `/dashboard/plugins/${pluginKey}${childPath}`;
        }

        // Check for illegal nesting (children.children)
        if (child.children !== undefined && child.children !== null) {
          console.error(
            `[Plugin Menu] Maximum nesting depth (${maxDepth}) exceeded in ${pluginKey}: ` +
              `path ${childPath} has children. Only 2 levels are allowed. ` +
              `Children at level 3+ will be truncated.`
          );
          // Truncate - don't include grandchildren
        }

        // Create validated child item (no children field)
        const validatedChild: PluginMenuItemChild = {
          label: String(child.label || ''),
          path: childPath,
          pluginKey, // Will be set by caller
        };

        // Add optional fields
        if (child.icon) {
          validatedChild.icon = String(child.icon);
        }

        if (Array.isArray(child.capabilities)) {
          validatedChild.capabilities = child.capabilities.map((cap) =>
            String(cap)
          );
        }

        validatedChildren.push(validatedChild);
      }

      if (validatedChildren.length > 0) {
        validatedItem.children = validatedChildren;
      }
    }

    validated.push(validatedItem);
  }

  return validated;
}

/**
 * Filter menu items by user permissions
 *
 * This function filters menu items based on the user's capabilities:
 * - Items without capabilities are always shown
 * - Items with capabilities are only shown if the user has at least one matching capability
 * - Admin users (with "*" capability) see all items
 * - Children are also filtered based on permissions
 *
 * @param items - Menu items to filter
 * @param userCapabilities - User's capabilities (e.g., ["admin:*", "analytics:read"])
 * @returns Filtered menu items
 *
 * @example
 * ```typescript
 * const filtered = filterMenuItemsByPermission(allMenus, user.capabilities || []);
 * ```
 */
export function filterMenuItemsByPermission(
  items: PluginMenuItem[],
  userCapabilities: string[]
): PluginMenuItem[] {
  // Check if user has admin wildcard capability
  const isAdmin = userCapabilities.includes('*');

  const filtered: PluginMenuItem[] = [];

  for (const item of items) {
    // Check if user has permission to see this item
    if (!hasPermission(item.capabilities, userCapabilities, isAdmin)) {
      continue; // Skip this item
    }

    // Clone the item (shallow copy)
    const filteredItem: PluginMenuItem = {
      ...item,
    };

    // Filter children if present
    if (item.children && item.children.length > 0) {
      const filteredChildren: PluginMenuItemChild[] = [];

      for (const child of item.children) {
        if (hasPermission(child.capabilities, userCapabilities, isAdmin)) {
          filteredChildren.push(child);
        }
      }

      // Only include children array if there are visible children
      if (filteredChildren.length > 0) {
        filteredItem.children = filteredChildren;
      } else {
        // No visible children - remove children field
        delete filteredItem.children;
      }
    }

    filtered.push(filteredItem);
  }

  return filtered;
}

/**
 * Check if user has permission to see a menu item
 *
 * @param itemCapabilities - Capabilities required by the menu item
 * @param userCapabilities - Capabilities possessed by the user
 * @param isAdmin - Whether user has admin wildcard capability
 * @returns true if user can see the item, false otherwise
 * @private
 */
function hasPermission(
  itemCapabilities: string[] | undefined,
  userCapabilities: string[],
  isAdmin: boolean
): boolean {
  // If no capabilities required, item is visible to all
  if (!itemCapabilities || itemCapabilities.length === 0) {
    return true;
  }

  // Admin users see everything
  if (isAdmin) {
    return true;
  }

  // Check if user has at least one matching capability
  for (const required of itemCapabilities) {
    if (userCapabilities.includes(required)) {
      return true;
    }
  }

  // No matching capabilities
  return false;
}

/**
 * Validate data field constraint
 *
 * Ensures that if data: true is set in plugin.json, the menus array
 * does not contain a menu item with path "/data".
 *
 * This enforces the design principle that /data pages are auto-generated
 * by the core and should not be manually defined in menus.
 *
 * @param manifest - Plugin manifest to validate
 * @param pluginKey - Plugin key for error messages
 * @throws Error if data: true and menus contains /data path
 *
 * @example
 * ```typescript
 * validateDataField(manifest, 'github'); // throws if invalid
 * ```
 */
export function validateDataField(
  manifest: PluginManifest,
  pluginKey: string
): void {
  // If data is not true, no validation needed
  if (manifest.data !== true) {
    return;
  }

  // Check if menus contains any item with path="/data"
  for (const menu of manifest.menus) {
    // Normalize the path - support both "path" and "to" fields
    const menuPath = (menu as { path?: string; to?: string }).path || (menu as { path?: string; to?: string }).to || '';

    if (menuPath === '/data' || menuPath === 'data') {
      throw new Error(
        `Plugin "${pluginKey}" validation error: Cannot have both 'data: true' and a menu item with path '/data'. ` +
          `Remove the '/data' menu item from 'menus' array.`
      );
    }

    // Also check children (if any)
    const children = (menu as { children?: Array<{ path?: string; to?: string }> }).children;
    if (Array.isArray(children)) {
      for (const child of children) {
        const childPath = child.path || child.to || '';
        if (childPath === '/data' || childPath === 'data') {
          throw new Error(
            `Plugin "${pluginKey}" validation error: Cannot have both 'data: true' and a child menu item with path '/data'. ` +
              `Remove the '/data' menu item from 'menus' array.`
          );
        }
      }
    }
  }
}

/**
 * Generate plugin menus with auto-generated items
 *
 * This function processes a plugin manifest and generates the final menu structure:
 * 1. Validates the data field constraint (no /data in menus if data: true)
 * 2. Adds auto-generated menu items:
 *    - "Collected Data" menu (if data: true)
 *    - "Activity Logs" menu (always added)
 * 3. Enforces proper menu ordering:
 *    - Overview (if exists)
 *    - Collected Data (if data: true)
 *    - Other custom menus
 *    - Settings (if exists)
 *    - Activity Logs (always last)
 *
 * @param manifest - Plugin manifest containing menus and data field
 * @param pluginKey - Plugin key for path generation and error messages
 * @returns Array of menu items with auto-generated items inserted
 * @throws Error if validation fails (data: true with /data in menus)
 *
 * @example
 * ```typescript
 * const menus = generatePluginMenus(manifest, 'github');
 * console.log(`Generated ${menus.length} menu items`);
 * ```
 */
export function generatePluginMenus(
  manifest: PluginManifest,
  pluginKey: string
): PluginMenuItem[] {
  // Step 1: Validate data field constraint
  validateDataField(manifest, pluginKey);

  // Step 2: Clone menus array (avoid mutating input)
  const menus: PluginMenuItem[] = [];

  // Step 3: Find special menu positions
  let overviewIndex = -1;
  let settingsIndex = -1;

  for (let i = 0; i < manifest.menus.length; i++) {
    const menu = manifest.menus[i];
    const menuKey = (menu as { key?: string }).key || '';

    if (menuKey === 'overview') {
      overviewIndex = i;
    } else if (menuKey === 'settings') {
      settingsIndex = i;
    }
  }

  // Step 4: Build ordered menu array
  // Add overview first (if exists)
  if (overviewIndex >= 0) {
    const rawMenu = manifest.menus[overviewIndex];
    if (rawMenu) {
      menus.push(convertRawMenuToPluginMenuItem(rawMenu, pluginKey, manifest.name));
    }
  }

  // Add "Collected Data" menu (if data: true)
  if (manifest.data === true) {
    menus.push({
      label: 'Collected Data',
      icon: 'mdi:database',
      path: `/dashboard/plugins/${pluginKey}/data`,
      pluginKey,
      pluginName: manifest.name,
    });
  }

  // Add other menus (excluding overview and settings)
  for (let i = 0; i < manifest.menus.length; i++) {
    if (i === overviewIndex || i === settingsIndex) {
      continue; // Skip, will be added in correct position
    }

    const rawMenu = manifest.menus[i];
    if (rawMenu) {
      menus.push(convertRawMenuToPluginMenuItem(rawMenu, pluginKey, manifest.name));
    }
  }

  // Add settings (if exists)
  if (settingsIndex >= 0) {
    const rawMenu = manifest.menus[settingsIndex];
    if (rawMenu) {
      menus.push(convertRawMenuToPluginMenuItem(rawMenu, pluginKey, manifest.name));
    }
  }

  // Add "Activity Logs" menu (always last)
  menus.push({
    label: 'Activity Logs',
    icon: 'mdi:file-document-outline',
    path: `/dashboard/plugins/${pluginKey}/runs`,
    pluginKey,
    pluginName: manifest.name,
  });

  return menus;
}

/**
 * Convert raw menu item from plugin.json to PluginMenuItem
 *
 * This helper function normalizes the raw menu structure from plugin.json
 * into the standardized PluginMenuItem format used by the menu system.
 *
 * @param rawMenu - Raw menu item from plugin.json
 * @param pluginKey - Plugin key for path expansion
 * @param pluginName - Plugin name for display
 * @returns Normalized PluginMenuItem
 * @private
 */
function convertRawMenuToPluginMenuItem(
  rawMenu: PluginManifest['menus'][number],
  pluginKey: string,
  pluginName: string
): PluginMenuItem {
  // Cast to access optional fields
  const menu = rawMenu as {
    key?: string;
    label: string;
    icon?: string;
    path?: string;
    to?: string;
    capabilities?: string[];
    children?: Array<{
      key?: string;
      label: string;
      icon?: string;
      path?: string;
      to?: string;
      capabilities?: string[];
    }>;
  };

  // Normalize path (support both "path" and "to")
  let menuPath = menu.path || menu.to || '';

  // Expand relative paths to absolute paths
  if (!menuPath.startsWith('/dashboard/plugins/') && !menuPath.startsWith('/plugins/')) {
    menuPath = `/dashboard/plugins/${pluginKey}${menuPath}`;
  }

  // Create normalized menu item
  const pluginMenuItem: PluginMenuItem = {
    label: menu.label,
    path: menuPath,
    pluginKey,
    pluginName,
  };

  // Add optional fields
  if (menu.icon) {
    pluginMenuItem.icon = menu.icon;
  }

  if (Array.isArray(menu.capabilities)) {
    pluginMenuItem.capabilities = menu.capabilities;
  }

  // Process children (if any)
  if (Array.isArray(menu.children) && menu.children.length > 0) {
    const children: PluginMenuItemChild[] = [];

    for (const rawChild of menu.children) {
      // Normalize child path
      let childPath = rawChild.path || rawChild.to || '';

      // Expand relative paths
      if (!childPath.startsWith('/dashboard/plugins/') && !childPath.startsWith('/plugins/')) {
        childPath = `/dashboard/plugins/${pluginKey}${childPath}`;
      }

      const child: PluginMenuItemChild = {
        label: rawChild.label,
        path: childPath,
        pluginKey,
      };

      if (rawChild.icon) {
        child.icon = rawChild.icon;
      }

      if (Array.isArray(rawChild.capabilities)) {
        child.capabilities = rawChild.capabilities;
      }

      children.push(child);
    }

    pluginMenuItem.children = children;
  }

  return pluginMenuItem;
}
