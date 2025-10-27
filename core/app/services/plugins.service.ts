/**
 * Plugin Service
 *
 * Business logic for plugin management operations.
 * Encapsulates database access and tenant context management.
 */

import { withTenantContext } from '../../db/connection.js';
import * as schema from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';

/**
 * List all plugins for a tenant
 *
 * @param tenantId - Tenant ID
 * @returns Array of plugin records
 */
export async function listPlugins(tenantId: string) {
  return await withTenantContext(tenantId, async (tx) => {
    return await tx
      .select()
      .from(schema.plugins)
      .where(eq(schema.plugins.tenantId, tenantId))
      .orderBy(schema.plugins.createdAt);
  });
}

/**
 * Update plugin enabled status
 *
 * @param tenantId - Tenant ID
 * @param pluginId - Plugin ID
 * @param enabled - New enabled status
 * @param config - Optional configuration update
 * @returns Updated plugin record or null if not found
 */
export async function updatePluginEnabled(
  tenantId: string,
  pluginId: string,
  enabled: boolean,
  config?: unknown
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
        eq(schema.plugins.pluginId, pluginId) &&
          eq(schema.plugins.tenantId, tenantId)
      )
      .returning();

    return updated ?? null;
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
export function redactConfig(config: unknown): unknown {
  if (!config || typeof config !== 'object') {
    return config;
  }

  const sensitivePattern = /key|secret|token|password|auth|credential|api[-_]?key/i;
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (sensitivePattern.test(key)) {
      redacted[key] = '***REDACTED***';
    } else if (value && typeof value === 'object') {
      redacted[key] = redactConfig(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}
