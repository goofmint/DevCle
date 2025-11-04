/**
 * Plugin Service
 *
 * Manages plugin configuration and state.
 *
 * Features:
 * - Get plugin by ID with tenant isolation
 * - Update plugin configuration with encryption
 * - Disable plugin with config deletion
 * - Automatic encryption/decryption of secret fields
 *
 * Security:
 * - All queries use RLS via withTenantContext()
 * - Secret fields are encrypted at rest
 * - Secret exists marker pattern for UI security
 */

import { eq, and } from 'drizzle-orm';
import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import type { PluginConfigSchema } from '../plugin-system/config-validator.js';
import {
  encryptPluginConfig,
  createSecretExistsMarkers,
} from '../plugin-system/config-encryption.js';

/**
 * Plugin information returned by service functions
 */
export interface PluginInfo {
  /** Plugin UUID */
  pluginId: string;

  /** Plugin key (unique identifier per tenant) */
  key: string;

  /** Plugin display name */
  name: string;

  /** Whether plugin is enabled */
  enabled: boolean;

  /** Plugin configuration (may contain encrypted secret fields) */
  config: Record<string, unknown> | null;

  /** Creation timestamp (ISO 8601) */
  createdAt: string;

  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/**
 * Find plugin by ID (returns null if not found)
 *
 * Retrieves plugin information with tenant isolation (RLS).
 * Returns null instead of throwing when plugin is not found.
 *
 * @param tenantId - Tenant ID for RLS
 * @param pluginId - Plugin UUID
 * @returns Plugin information or null if not found
 */
export async function findPluginById(
  tenantId: string,
  pluginId: string
): Promise<PluginInfo | null> {
  return await withTenantContext(tenantId, async (tx) => {
    // Query plugins table with RLS
    const rows = await tx
      .select()
      .from(schema.plugins)
      .where(
        and(
          eq(schema.plugins.tenantId, tenantId),
          eq(schema.plugins.pluginId, pluginId)
        )
      )
      .limit(1);

    const row = rows[0];

    if (!row) {
      return null;
    }

    // Convert to PluginInfo format
    return {
      pluginId: row.pluginId,
      key: row.key,
      name: row.name,
      enabled: row.enabled,
      config: row.config as Record<string, unknown> | null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

/**
 * Find plugin by key (string identifier)
 *
 * Retrieves plugin information by key with tenant isolation (RLS).
 * Returns null when plugin is not found.
 *
 * @param tenantId - Tenant ID for RLS
 * @param key - Plugin key (e.g., "drowl-plugin-test")
 * @returns Plugin information or null if not found
 */
export async function findPluginByKey(
  tenantId: string,
  key: string
): Promise<PluginInfo | null> {
  return await withTenantContext(tenantId, async (tx) => {
    // Query plugins table with RLS by key
    const rows = await tx
      .select()
      .from(schema.plugins)
      .where(
        and(
          eq(schema.plugins.tenantId, tenantId),
          eq(schema.plugins.key, key)
        )
      )
      .limit(1);

    const row = rows[0];

    if (!row) {
      return null;
    }

    // Convert to PluginInfo format
    return {
      pluginId: row.pluginId,
      key: row.key,
      name: row.name,
      enabled: row.enabled,
      config: row.config as Record<string, unknown> | null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

/**
 * Get plugin by ID (throws if not found)
 *
 * Retrieves plugin information with tenant isolation (RLS).
 * Throws an error when plugin is not found.
 *
 * @param tenantId - Tenant ID for RLS
 * @param pluginId - Plugin UUID
 * @returns Plugin information
 * @throws Error if plugin not found
 */
export async function getPluginById(
  tenantId: string,
  pluginId: string
): Promise<PluginInfo> {
  const plugin = await findPluginById(tenantId, pluginId);

  if (!plugin) {
    throw new Error(`Plugin not found: ${pluginId}`);
  }

  return plugin;
}

/**
 * Get plugin by key (throws if not found)
 *
 * Retrieves plugin information by key with tenant isolation (RLS).
 * Throws an error when plugin is not found.
 *
 * @param tenantId - Tenant ID for RLS
 * @param key - Plugin key (e.g., "drowl-plugin-test")
 * @returns Plugin information
 * @throws Error if plugin not found
 */
export async function getPluginByKey(
  tenantId: string,
  key: string
): Promise<PluginInfo> {
  const plugin = await findPluginByKey(tenantId, key);

  if (!plugin) {
    throw new Error(`Plugin not found: ${key}`);
  }

  return plugin;
}

/**
 * Update plugin configuration
 *
 * Updates plugin configuration with automatic encryption of secret fields.
 * Supports secret exists marker pattern ({ _exists: true }) to preserve
 * existing secret values without exposing them to the client.
 *
 * @param tenantId - Tenant ID for RLS
 * @param pluginId - Plugin UUID
 * @param configSchema - Plugin configuration schema (from plugin.json)
 * @param config - New configuration values (may include secret exists markers)
 * @returns Updated plugin information (with secret fields marked)
 * @throws Error if plugin not found
 * @throws Error if encryption fails
 */
export async function updatePluginConfig(
  tenantId: string,
  pluginId: string,
  configSchema: PluginConfigSchema,
  config: Record<string, unknown>
): Promise<PluginInfo> {
  return await withTenantContext(tenantId, async (tx) => {
    // Get existing plugin to retrieve current encrypted config
    const existingRows = await tx
      .select()
      .from(schema.plugins)
      .where(
        and(
          eq(schema.plugins.tenantId, tenantId),
          eq(schema.plugins.pluginId, pluginId)
        )
      )
      .limit(1);

    const existingRow = existingRows[0];

    if (!existingRow) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    const existingConfig = existingRow.config as Record<string, unknown> | null;

    // Encrypt secret fields (preserves existing values for secret exists markers)
    const encryptedConfig = await encryptPluginConfig(
      configSchema,
      config,
      existingConfig || undefined
    );

    // Update plugins table with RLS
    const updatedRows = await tx
      .update(schema.plugins)
      .set({
        config: encryptedConfig,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.plugins.tenantId, tenantId),
          eq(schema.plugins.pluginId, pluginId)
        )
      )
      .returning();

    const updatedRow = updatedRows[0];

    if (!updatedRow) {
      throw new Error(`Failed to update plugin: ${pluginId}`);
    }

    // Return updated plugin info with secret exists markers
    const configWithMarkers = createSecretExistsMarkers(
      configSchema,
      updatedRow.config as Record<string, unknown> || {}
    );

    return {
      pluginId: updatedRow.pluginId,
      key: updatedRow.key,
      name: updatedRow.name,
      enabled: updatedRow.enabled,
      config: configWithMarkers,
      createdAt: updatedRow.createdAt.toISOString(),
      updatedAt: updatedRow.updatedAt.toISOString(),
    };
  });
}

/**
 * Disable plugin and delete all configuration
 *
 * Sets enabled flag to false and clears the config field.
 * This operation is irreversible - all configuration is lost.
 *
 * @param tenantId - Tenant ID for RLS
 * @param pluginId - Plugin UUID
 * @returns Updated plugin information (enabled=false, config=null)
 * @throws Error if plugin not found
 */
export async function disablePlugin(
  tenantId: string,
  pluginId: string
): Promise<PluginInfo> {
  return await withTenantContext(tenantId, async (tx) => {
    // Update plugins table with RLS
    const updatedRows = await tx
      .update(schema.plugins)
      .set({
        enabled: false,
        config: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.plugins.tenantId, tenantId),
          eq(schema.plugins.pluginId, pluginId)
        )
      )
      .returning();

    const updatedRow = updatedRows[0];

    if (!updatedRow) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    return {
      pluginId: updatedRow.pluginId,
      key: updatedRow.key,
      name: updatedRow.name,
      enabled: updatedRow.enabled,
      config: updatedRow.config as Record<string, unknown> | null,
      createdAt: updatedRow.createdAt.toISOString(),
      updatedAt: updatedRow.updatedAt.toISOString(),
    };
  });
}
