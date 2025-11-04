/**
 * Plugin Service
 *
 * Business logic for plugin management operations.
 * Encapsulates database access and tenant context management.
 */

import { withTenantContext } from '../../db/connection.js';
import * as schema from '../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import {
  listAvailablePlugins,
  getPluginConfig,
} from '../../services/plugin/plugin-config.service.js';
import type { PluginConfigValues, PluginSettingValue } from '../../plugin-system/types.js';

/**
 * List all plugins for a tenant
 *
 * Reads from filesystem (plugin.json) as source of truth and merges with DB state.
 * Only returns plugins that actually exist in the filesystem.
 *
 * @param tenantId - Tenant ID
 * @returns Array of plugin records with merged data from filesystem and DB
 */
export async function listPlugins(tenantId: string) {
  // 1. Get all available plugins from filesystem
  const availablePluginKeys = await listAvailablePlugins();

  // 2. Get DB state for all plugins
  const dbPlugins = await withTenantContext(tenantId, async (tx) => {
    return await tx
      .select()
      .from(schema.plugins)
      .where(eq(schema.plugins.tenantId, tenantId));
  });

  // 3. Create a map of DB state by plugin key
  const dbPluginMap = new Map(dbPlugins.map((p) => [p.key, p]));

  // 4. Merge filesystem data with DB state
  const mergedPlugins = [];
  const processedKeys = new Set<string>();

  // First, process plugins that exist in filesystem
  for (const pluginKey of availablePluginKeys) {
    processedKeys.add(pluginKey);
    try {
      // Get plugin config from filesystem
      const config = await getPluginConfig(pluginKey, tenantId);

      // Get DB state (if exists)
      const dbPlugin = dbPluginMap.get(pluginKey);

      // Merge data
      mergedPlugins.push({
        pluginId: dbPlugin?.pluginId ?? '',
        tenantId,
        key: pluginKey,
        name: config.basicInfo.name,
        version: config.basicInfo.version,
        enabled: dbPlugin?.enabled ?? false,
        config: dbPlugin?.config ?? {},
        hasSettings: (config.settingsSchema?.length ?? 0) > 0,
        createdAt: dbPlugin?.createdAt ?? new Date(),
        updatedAt: dbPlugin?.updatedAt ?? new Date(),
      });
    } catch (error) {
      // Skip plugins that can't be loaded
      console.warn(`Failed to load plugin ${pluginKey}:`, error);
    }
  }

  // Then, include DB-only plugins (no filesystem directory)
  for (const dbPlugin of dbPlugins) {
    if (!processedKeys.has(dbPlugin.key)) {
      mergedPlugins.push({
        pluginId: dbPlugin.pluginId,
        tenantId: dbPlugin.tenantId,
        key: dbPlugin.key,
        name: dbPlugin.name,
        version: '0.0.0', // No plugin.json, use default
        enabled: dbPlugin.enabled,
        config: dbPlugin.config ?? {},
        hasSettings: false, // No plugin.json, no settings
        createdAt: dbPlugin.createdAt,
        updatedAt: dbPlugin.updatedAt,
      });
    }
  }

  return mergedPlugins;
}

/**
 * Get a plugin by ID with tenant isolation
 *
 * Encapsulates tenant-scoped DB access so loaders don't handle DB/tenant logic directly.
 *
 * @param tenantId - Tenant ID
 * @param pluginId - Plugin ID
 * @returns Plugin record or null if not found
 */
export async function getPluginById(tenantId: string, pluginId: string) {
  return await withTenantContext(tenantId, async (tx) => {
    const [plugin] = await tx
      .select()
      .from(schema.plugins)
      .where(
        and(
          eq(schema.plugins.pluginId, pluginId),
          eq(schema.plugins.tenantId, tenantId)
        )
      )
      .limit(1);

    return plugin ?? null;
  });
}

/**
 * Update plugin enabled status
 *
 * Merges DB state with filesystem data (plugin.json) for response.
 *
 * @param tenantId - Tenant ID
 * @param pluginId - Plugin ID
 * @param enabled - New enabled status
 * @param config - Optional configuration update
 * @returns Updated plugin record with data from filesystem, or null if not found
 */
export async function updatePluginEnabled(
  tenantId: string,
  pluginId: string,
  enabled: boolean,
  config?: PluginConfigValues | null
) {
  return await withTenantContext(tenantId, async (tx) => {
    // Build update values
    const updates: Partial<typeof schema.plugins.$inferInsert> = {
      enabled,
      updatedAt: new Date(),
    };

    if (config !== undefined) {
      updates.config = config;
    }

    // Update plugin
    const [updated] = await tx
      .update(schema.plugins)
      .set(updates)
      .where(
        and(
          eq(schema.plugins.pluginId, pluginId),
          eq(schema.plugins.tenantId, tenantId)
        )
      )
      .returning();

    if (!updated) {
      return null;
    }

    // Get plugin metadata from filesystem
    try {
      const pluginConfig = await getPluginConfig(updated.key, tenantId);

      // Merge DB state with filesystem data
      return {
        ...updated,
        name: pluginConfig.basicInfo.name,
        version: pluginConfig.basicInfo.version,
      };
    } catch (error) {
      // If filesystem read fails, return DB data with fallback values
      // Note: DB schema doesn't have 'version' field, so we use a default value
      console.warn(`Failed to read plugin.json for ${updated.key}:`, error);
      return {
        ...updated,
        name: updated.name || updated.key || 'unknown-plugin',
        version: '0.0.0',
      };
    }
  });
}

/**
 * Redact sensitive configuration fields
 *
 * Masks values for keys matching sensitive patterns (key, secret, token, password, etc.)
 *
 * @param config - Raw configuration object
 * @returns Configuration with sensitive fields redacted
 */
export function redactConfig(config: PluginConfigValues | null): PluginConfigValues | null {
  if (!config || typeof config !== 'object') {
    return config;
  }

  const sensitivePattern = /key|secret|token|password|auth|credential|api[-_]?key/i;
  const redacted: Record<string, PluginSettingValue> = {};

  for (const [key, value] of Object.entries(config)) {
    if (sensitivePattern.test(key)) {
      redacted[key] = '***REDACTED***';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Only recursively redact for objects (not arrays)
      redacted[key] = '***REDACTED***'; // For safety, redact nested objects
    } else {
      redacted[key] = value;
    }
  }

  return redacted as PluginConfigValues;
}
