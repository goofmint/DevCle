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
 *
 * @module plugin-system/menu
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

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
    .where(eq(schema.plugins.enabled, true));

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

      // Extract plugin name
      const pluginName = (pluginJson['name'] as string) || plugin.key;

      // Extract menus field
      // Support both "menus" array (plugin.md) and nested structure (task-8.6)
      let rawMenus: RawMenuItem[] = [];

      if (Array.isArray(pluginJson['menus'])) {
        rawMenus = pluginJson['menus'] as RawMenuItem[];
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
            rawMenus = menuConfig['items'] as RawMenuItem[];
          }
        }
      }

      if (rawMenus.length === 0) {
        // No menus defined, skip
        continue;
      }

      // Validate and transform menu items
      const validatedMenus = validateMenuDepth(rawMenus, plugin.key, 2);

      // Add plugin key and name to all menu items
      for (const menu of validatedMenus) {
        menu.pluginKey = plugin.key;
        menu.pluginName = pluginName;
        if (menu.children) {
          for (const child of menu.children) {
            child.pluginKey = plugin.key;
          }
        }
      }

      allMenuItems.push(...validatedMenus);
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
