/**
 * Widgets Service
 *
 * Business logic for widget management and data retrieval.
 * Reads widget definitions from plugin.json files and provides widget catalog.
 *
 * Key responsibilities:
 * - List all available widgets from installed plugins
 * - Get specific widget definitions
 * - Fetch widget data via widget-data.service
 * - Manage user widget layouts
 *
 * Security notes:
 * - Only returns widgets from enabled plugins
 * - Enforces tenant isolation via withTenantContext()
 */

import {
  listPlugins,
  getPluginById,
} from './plugins.service.js';
import {
  getPluginConfig,
} from '../../services/plugin/plugin-config.service.js';
import { fetchWidgetData } from './widget-data.service.js';
import { withTenantContext } from '../../db/connection.js';
import * as schema from '../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import type { WidgetData, WidgetDataSource } from '../types/widget-api.js';

/**
 * Widget catalog entry
 *
 * Represents a widget available from a plugin.
 */
export interface WidgetInfo {
  /** Widget ID in format "pluginId:widgetKey" */
  id: string;
  /** Plugin ID that provides this widget */
  pluginId: string;
  /** Widget key (unique within plugin) */
  key: string;
  /** Widget type (stat, table, list, timeseries, card) */
  type: string;
  /** Widget title */
  title: string;
  /** Widget schema version */
  version: string;
}

/**
 * Full widget definition including dataSource
 */
interface WidgetDefinition extends WidgetInfo {
  /** Data source definition */
  dataSource: WidgetDataSource;
}

/**
 * List all available widgets from enabled plugins
 *
 * Reads plugin.json files from all enabled plugins and collects widget definitions.
 * Only returns widgets from plugins that are enabled for the tenant.
 *
 * @param tenantId - Tenant ID
 * @returns Array of widget information
 */
export async function listAllWidgets(tenantId: string): Promise<WidgetInfo[]> {
  // Get all plugins for tenant
  const plugins = await listPlugins(tenantId);

  // Filter enabled plugins only
  const enabledPlugins = plugins.filter((p) => p.enabled);

  // Collect widgets from all enabled plugins
  const widgets: WidgetInfo[] = [];

  for (const plugin of enabledPlugins) {
    try {
      // Get plugin configuration (reads plugin.json)
      const config = await getPluginConfig(plugin.key, tenantId);

      // Extract widgets from plugin config
      if (config.widgets && config.widgets.length > 0) {
        for (const widget of config.widgets) {
          widgets.push({
            id: `${plugin.pluginId}:${widget.key}`,
            pluginId: plugin.pluginId,
            key: widget.key,
            type: widget.type,
            title: widget.title,
            version: widget.version,
          });
        }
      }
    } catch (error) {
      // Log error but continue processing other plugins
      console.warn(`Failed to load widgets from plugin ${plugin.key}:`, error);
    }
  }

  return widgets;
}

/**
 * Get widget definition by ID
 *
 * Parses widgetId in format "pluginId:widgetKey" and returns full widget definition
 * including dataSource.
 *
 * @param tenantId - Tenant ID
 * @param widgetId - Widget ID in format "pluginId:widgetKey"
 * @returns Widget definition with dataSource
 * @throws {Error} If widget not found or plugin not enabled
 */
export async function getWidgetDefinition(
  tenantId: string,
  widgetId: string
): Promise<WidgetDefinition> {
  // Parse widgetId (format: "pluginId:widgetKey")
  const parts = widgetId.split(':');
  if (parts.length !== 2) {
    throw new Error(`Invalid widget ID format: ${widgetId}`);
  }

  const [pluginIdRaw, widgetKeyRaw] = parts;
  if (!pluginIdRaw || !widgetKeyRaw) {
    throw new Error(`Invalid widget ID format: ${widgetId}`);
  }

  const pluginId = pluginIdRaw;
  const widgetKey = widgetKeyRaw;

  // Get plugin record
  const plugin = await getPluginById(tenantId, pluginId);
  if (!plugin) {
    throw new Error(`Plugin not found: ${pluginId}`);
  }

  // Check if plugin is enabled
  if (!plugin.enabled) {
    throw new Error(`Plugin is disabled: ${pluginId}`);
  }

  // Validate plugin.key exists
  if (!plugin.key) {
    throw new Error(`Plugin key is missing for plugin ${pluginId}`);
  }

  // Get plugin configuration
  const config = await getPluginConfig(plugin.key, tenantId);

  // Find widget in plugin config
  const widgetDef = config.widgets?.find((w) => w.key === widgetKey);
  if (!widgetDef) {
    throw new Error(`Widget not found: ${widgetKey} in plugin ${pluginId}`);
  }

  // Validate dataSource exists
  if (!widgetDef.dataSource) {
    throw new Error(`Widget dataSource is missing for ${widgetKey} in plugin ${pluginId}`);
  }

  return {
    id: widgetId,
    pluginId,
    key: widgetDef.key,
    type: widgetDef.type,
    title: widgetDef.title,
    version: widgetDef.version,
    dataSource: widgetDef.dataSource,
  };
}

/**
 * Get widget data by ID
 *
 * Fetches widget definition and executes data query via widget-data.service.
 *
 * @param tenantId - Tenant ID
 * @param widgetId - Widget ID in format "pluginId:widgetKey"
 * @returns Widget data matching widget type
 */
export async function getWidgetData(
  tenantId: string,
  widgetId: string
): Promise<WidgetData> {
  // Get widget definition (includes dataSource)
  const widgetDef = await getWidgetDefinition(tenantId, widgetId);

  // Fetch data via widget-data service
  return await fetchWidgetData(
    tenantId,
    widgetDef.type,
    widgetDef.title,
    widgetDef.version,
    widgetDef.dataSource
  );
}

/**
 * Save user widget layout
 *
 * Stores widget layout configuration in user_preferences table.
 * Uses upsert pattern (insert or update on conflict).
 *
 * @param tenantId - Tenant ID
 * @param userId - User ID
 * @param layout - Layout configuration (Swapy format)
 */
export async function saveWidgetLayout(
  tenantId: string,
  userId: string,
  layout: Record<string, string>
): Promise<void> {
  // Validate layout structure and size
  if (!layout || typeof layout !== 'object') {
    throw new Error('Invalid layout: must be an object');
  }

  // Limit number of layout entries to prevent abuse
  const layoutKeys = Object.keys(layout);
  if (layoutKeys.length > 100) {
    throw new Error('Invalid layout: too many entries (max 100)');
  }

  // Validate each layout entry
  for (const [key, value] of Object.entries(layout)) {
    // Key validation (slot IDs should be reasonable length)
    if (typeof key !== 'string' || key.length > 100) {
      throw new Error(`Invalid layout key: "${key}" (must be string, max 100 chars)`);
    }

    // Value validation (widget IDs should be reasonable length)
    if (typeof value !== 'string' || value.length > 200) {
      throw new Error(`Invalid layout value for "${key}": "${value}" (must be string, max 200 chars)`);
    }
  }

  await withTenantContext(tenantId, async (tx) => {
    await tx
      .insert(schema.userPreferences)
      .values({
        userId,
        tenantId,
        key: 'widget_layout',
        value: layout,
      })
      .onConflictDoUpdate({
        // Note: Current unique constraint is (userId, key)
        // For better multi-tenancy safety, should include tenantId in constraint
        target: [schema.userPreferences.userId, schema.userPreferences.key],
        set: {
          value: layout,
          updatedAt: new Date(),
        },
      });
  });
}

/**
 * Get user widget layout
 *
 * Retrieves widget layout configuration from user_preferences table.
 *
 * @param tenantId - Tenant ID
 * @param userId - User ID
 * @returns Layout configuration or null if not found
 */
export async function getWidgetLayout(
  tenantId: string,
  userId: string
): Promise<Record<string, string> | null> {
  return await withTenantContext(tenantId, async (tx) => {
    const [preference] = await tx
      .select()
      .from(schema.userPreferences)
      .where(
        and(
          eq(schema.userPreferences.userId, userId),
          eq(schema.userPreferences.key, 'widget_layout')
        )
      )
      .limit(1);

    return (preference?.value as Record<string, string>) ?? null;
  });
}
