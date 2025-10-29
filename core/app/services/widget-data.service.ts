/**
 * Widget Data Service
 *
 * Business logic for widget data fetching based on declarative dataSource definitions.
 * Converts plugin.json widget dataSource into Drizzle queries and returns formatted widget data.
 *
 * Key responsibilities:
 * - Execute declarative queries from plugin.json widgets
 * - Handle different entity types (developers, activities, campaigns, etc.)
 * - Support aggregations (count, sum, avg, min, max)
 * - Support time-series grouping (hour, day, week, month)
 * - Enforce tenant isolation via withTenantContext()
 *
 * Security notes:
 * - All queries MUST use withTenantContext() for RLS
 * - Filter conditions MUST include "source" field for plugin data isolation
 * - Never expose raw database errors to client
 */

import { withTenantContext } from '../../db/connection.js';
import * as schema from '../../db/schema/index.js';
import { eq, and, sql, count, sum, avg, min, max, desc, asc } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type {
  WidgetDataSource,
  StatWidgetData,
  TimeseriesWidgetData,
  TableWidgetData,
  ListWidgetData,
  CardWidgetData,
  WidgetData,
} from '../types/widget-api.js';

/**
 * Fetch widget data based on dataSource definition
 *
 * Core function that executes declarative queries from plugin.json.
 * Converts dataSource specification into appropriate Drizzle query.
 *
 * @param tenantId - Tenant ID for RLS context
 * @param widgetType - Widget type (stat, table, list, timeseries, card)
 * @param title - Widget title (for response)
 * @param version - Widget schema version (for response)
 * @param dataSource - Declarative data source definition from plugin.json
 * @returns Formatted widget data matching widget type
 * @throws {Error} If entity is unknown or query fails
 */
export async function fetchWidgetData(
  tenantId: string,
  widgetType: string,
  title: string,
  version: string,
  dataSource: WidgetDataSource
): Promise<WidgetData> {
  return await withTenantContext(tenantId, async (tx) => {
    // Get table for entity
    const table = getTableForEntity(dataSource.entity);

    // Build filter conditions
    const filters = buildFilters(dataSource.filter);

    // Route to appropriate handler based on widget type
    switch (widgetType) {
      case 'stat':
        return await fetchStatData(tx, tenantId, table, filters, dataSource, title, version);
      case 'timeseries':
        return await fetchTimeseriesData(tx, tenantId, table, filters, dataSource, title, version);
      case 'table':
        return await fetchTableData(tx, tenantId, table, filters, dataSource, title, version);
      case 'list':
        return await fetchListData(tx, tenantId, table, filters, dataSource, title, version);
      case 'card':
        // Card widgets typically have static content defined in plugin.json
        // For now, return stub data
        return {
          version,
          type: 'card',
          title,
          data: {
            content: 'Widget data loading...',
          },
        } as CardWidgetData;
      default:
        throw new Error(`Unsupported widget type: ${widgetType}`);
    }
  });
}

/**
 * Fetch stat widget data (single aggregated value)
 *
 * @param tx - Transaction client
 * @param tenantId - Tenant ID
 * @param table - Table to query
 * @param filters - WHERE conditions
 * @param dataSource - Data source definition
 * @param title - Widget title
 * @param version - Widget schema version
 * @returns Stat widget data
 */
async function fetchStatData(
  tx: any,
  tenantId: string,
  table: any,
  filters: SQL[],
  dataSource: WidgetDataSource,
  title: string,
  version: string
): Promise<StatWidgetData> {
  if (!dataSource.aggregation) {
    throw new Error('Stat widget requires aggregation definition');
  }

  const agg = dataSource.aggregation;
  let aggregationExpr: SQL;

  // Build aggregation expression
  switch (agg.op) {
    case 'count':
      aggregationExpr = count();
      break;
    case 'sum':
      if (!agg.field) {
        throw new Error('sum aggregation requires field parameter');
      }
      aggregationExpr = sum(table[agg.field]);
      break;
    case 'avg':
      if (!agg.field) {
        throw new Error('avg aggregation requires field parameter');
      }
      aggregationExpr = avg(table[agg.field]);
      break;
    case 'min':
      if (!agg.field) {
        throw new Error('min aggregation requires field parameter');
      }
      aggregationExpr = min(table[agg.field]);
      break;
    case 'max':
      if (!agg.field) {
        throw new Error('max aggregation requires field parameter');
      }
      aggregationExpr = max(table[agg.field]);
      break;
    default:
      throw new Error(`Unsupported aggregation operation: ${agg.op}`);
  }

  // Execute query
  const result = await tx
    .select({ value: aggregationExpr })
    .from(table)
    .where(and(eq(table.tenantId, tenantId), ...filters))
    .limit(1);

  // Extract value (handle null/undefined)
  const rawValue = result[0]?.value;
  const value = rawValue !== null && rawValue !== undefined ? Number(rawValue) : 0;

  return {
    version,
    type: 'stat',
    title,
    data: {
      value,
      // TODO: Calculate trend if needed (requires historical comparison)
    },
  };
}

/**
 * Fetch timeseries widget data (time-bucketed aggregations)
 *
 * Groups data by time buckets (hour/day/week/month) and aggregates.
 *
 * @param tx - Transaction client
 * @param tenantId - Tenant ID
 * @param table - Table to query
 * @param filters - WHERE conditions
 * @param dataSource - Data source definition
 * @param title - Widget title
 * @param version - Widget schema version
 * @returns Timeseries widget data
 */
async function fetchTimeseriesData(
  tx: any,
  tenantId: string,
  table: any,
  filters: SQL[],
  dataSource: WidgetDataSource,
  title: string,
  version: string
): Promise<TimeseriesWidgetData> {
  if (!dataSource.aggregation) {
    throw new Error('Timeseries widget requires aggregation definition');
  }

  const agg = dataSource.aggregation;
  const bucket = agg.bucket || 'day';

  // Build time bucket expression (PostgreSQL date_trunc)
  const timeBucketExpr = sql`date_trunc(${bucket}, ${table.occurredAt})`;

  // Build aggregation expression
  let aggregationExpr: SQL;
  switch (agg.op) {
    case 'count':
      aggregationExpr = count();
      break;
    case 'sum':
      if (!agg.field) {
        throw new Error('sum aggregation requires field parameter');
      }
      aggregationExpr = sum(table[agg.field]);
      break;
    default:
      // For timeseries, typically only count and sum make sense
      throw new Error(`Unsupported timeseries aggregation: ${agg.op}`);
  }

  // Execute query with GROUP BY
  const result = await tx
    .select({
      bucket: timeBucketExpr,
      value: aggregationExpr,
    })
    .from(table)
    .where(and(eq(table.tenantId, tenantId), ...filters))
    .groupBy(timeBucketExpr)
    .orderBy(asc(timeBucketExpr));

  // Convert to timeseries format
  const points: Array<[string, number]> = result.map((row: any) => [
    row.bucket.toISOString().split('T')[0], // Format as YYYY-MM-DD
    Number(row.value ?? 0),
  ]);

  return {
    version,
    type: 'timeseries',
    title,
    data: {
      interval: bucket,
      series: [
        {
          label: title, // Default to widget title, can be customized
          points,
        },
      ],
    },
  };
}

/**
 * Fetch table widget data (columnar data)
 *
 * @param tx - Transaction client
 * @param tenantId - Tenant ID
 * @param table - Table to query
 * @param filters - WHERE conditions
 * @param dataSource - Data source definition
 * @param title - Widget title
 * @param version - Widget schema version
 * @returns Table widget data
 */
async function fetchTableData(
  tx: any,
  tenantId: string,
  table: any,
  filters: SQL[],
  dataSource: WidgetDataSource,
  title: string,
  version: string
): Promise<TableWidgetData> {
  const columns = dataSource.columns || [];
  const limit = dataSource.limit || 100;

  // Build SELECT clause (if columns specified, select only those)
  let query = tx.select().from(table);

  // Apply filters
  query = query.where(and(eq(table.tenantId, tenantId), ...filters));

  // Apply sorting
  if (dataSource.sort) {
    const sortCol = table[dataSource.sort.key];
    if (!sortCol) {
      throw new Error(`Unknown sort column: ${dataSource.sort.key}`);
    }
    query = query.orderBy(dataSource.sort.dir === 'asc' ? asc(sortCol) : desc(sortCol));
  }

  // Apply limit
  query = query.limit(limit);

  // Execute query
  const rows = await query;

  // Build column definitions
  const columnDefs = columns.map((key) => ({
    key,
    label: key.charAt(0).toUpperCase() + key.slice(1), // Capitalize first letter
  }));

  return {
    version,
    type: 'table',
    title,
    data: {
      columns: columnDefs,
      rows: rows.map((row: any) => {
        // Extract only specified columns if defined
        if (columns.length > 0) {
          const filtered: Record<string, string | number> = {};
          for (const col of columns) {
            filtered[col] = row[col] ?? '-';
          }
          return filtered;
        }
        return row;
      }),
    },
  };
}

/**
 * Fetch list widget data (item list with metadata)
 *
 * @param tx - Transaction client
 * @param tenantId - Tenant ID
 * @param table - Table to query
 * @param filters - WHERE conditions
 * @param dataSource - Data source definition
 * @param title - Widget title
 * @param version - Widget schema version
 * @returns List widget data
 */
async function fetchListData(
  tx: any,
  tenantId: string,
  table: any,
  filters: SQL[],
  dataSource: WidgetDataSource,
  title: string,
  version: string
): Promise<ListWidgetData> {
  const limit = dataSource.limit || 10;

  // Execute query
  let query = tx.select().from(table);
  query = query.where(and(eq(table.tenantId, tenantId), ...filters));

  // Apply sorting
  if (dataSource.sort) {
    const sortCol = table[dataSource.sort.key];
    if (!sortCol) {
      throw new Error(`Unknown sort column: ${dataSource.sort.key}`);
    }
    query = query.orderBy(dataSource.sort.dir === 'asc' ? asc(sortCol) : desc(sortCol));
  }

  query = query.limit(limit);

  const rows = await query;

  // Convert rows to list items
  // Heuristic: use first ID field, first text field, first timestamp
  const items = rows.map((row: any) => {
    // Find ID field (ends with "Id" or "_id")
    const idField = Object.keys(row).find((key) => key.endsWith('Id') || key.endsWith('_id'));
    const id = idField ? String(row[idField]) : String(Math.random());

    // Find title field (name, title, action, etc.)
    const titleField = Object.keys(row).find((key) =>
      ['name', 'title', 'action', 'displayName'].includes(key)
    );
    const itemTitle = titleField ? String(row[titleField]) : 'Untitled';

    // Find timestamp field
    const timestampField = Object.keys(row).find((key) =>
      key.includes('At') || key.includes('_at')
    );
    const timestamp = timestampField ? new Date(row[timestampField]).toISOString() : undefined;

    return {
      id,
      title: itemTitle,
      timestamp,
      // TODO: Add description and link fields based on entity type
    };
  });

  return {
    version,
    type: 'list',
    title,
    data: {
      items,
    },
  };
}

/**
 * Get Drizzle table object for entity name
 *
 * Maps entity string (from plugin.json) to actual Drizzle schema table.
 *
 * @param entity - Entity name (e.g., "developers", "activities")
 * @returns Drizzle table object
 * @throws {Error} If entity is unknown
 */
function getTableForEntity(entity: string): any {
  switch (entity) {
    case 'developers':
      return schema.developers;
    case 'activities':
      return schema.activities;
    case 'campaigns':
      return schema.campaigns;
    case 'organizations':
      return schema.organizations;
    case 'resources':
      return schema.resources;
    case 'accounts':
      return schema.accounts;
    // Add more entities as needed
    default:
      throw new Error(`Unknown entity: ${entity}`);
  }
}

/**
 * Build WHERE filter conditions from dataSource filter object
 *
 * Converts filter object (e.g., { source: "github", createdAt: { gte: "2025-01-01" } })
 * into Drizzle SQL conditions.
 *
 * @param filter - Filter object from dataSource
 * @returns Array of SQL conditions
 */
function buildFilters(filter?: Record<string, unknown>): SQL[] {
  if (!filter) {
    return [];
  }

  const conditions: SQL[] = [];

  for (const [key, value] of Object.entries(filter)) {
    if (value === null || value === undefined) {
      continue;
    }

    // Handle nested operators (gte, lte, gt, lt, etc.)
    if (typeof value === 'object' && !Array.isArray(value)) {
      const operators = value as Record<string, unknown>;
      for (const [op, opValue] of Object.entries(operators)) {
        switch (op) {
          case 'gte':
            conditions.push(sql`${sql.identifier(key)} >= ${opValue}`);
            break;
          case 'lte':
            conditions.push(sql`${sql.identifier(key)} <= ${opValue}`);
            break;
          case 'gt':
            conditions.push(sql`${sql.identifier(key)} > ${opValue}`);
            break;
          case 'lt':
            conditions.push(sql`${sql.identifier(key)} < ${opValue}`);
            break;
          default:
            console.warn(`Unknown filter operator: ${op}`);
        }
      }
    } else {
      // Simple equality check
      conditions.push(sql`${sql.identifier(key)} = ${value}`);
    }
  }

  return conditions;
}
